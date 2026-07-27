import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File, digestUri } from './lib/hash.mjs';
import { resolveDependencies } from './lib/resolver.mjs';
import { writeLockfile } from './lib/lockfile.mjs';
import { transferFile, planChunkRanges } from './lib/transfer.mjs';
import { putBytes } from './lib/store.mjs';
import { loadTaskfile, planTasks, runTasks } from './task/engine.mjs';
import { policyCheck } from './policy/check.mjs';
import { doctor } from './policy/doctor.mjs';
import { loadOwnershipConfig, ownershipPlan, DEFAULT_CONFIG } from './seo/ownership.mjs';
import { generateSeoAssets } from './seo/generate.mjs';
import { prevalidateOwnership } from './seo/prevalidate.mjs';
import { googleSearchConsole } from './seo/google.mjs';
import { indexNowSubmit } from './seo/indexnow.mjs';
import { createRegistry } from './server/registry.mjs';

const ExitCode = { OK: 0, FAIL: 1, USAGE: 2 };
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function runCli(argv) {
  const [command, ...rest] = argv;
  const json = hasFlag(rest, '--json') || hasFlag(rest, '-j');
  const force = hasFlag(rest, '--force') || hasFlag(rest, '-f');
  const execute = hasFlag(rest, '--execute');
  const live = hasFlag(rest, '--live');
  const capture = hasFlag(rest, '--capture');
  const dryRun = hasFlag(rest, '--dry-run');
  const jobs = Number(flagValue(rest, '--jobs') || 0) || undefined;
  const receipt = flagValue(rest, '--receipt');

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(helpText());
    return ExitCode.OK;
  }

  if (command === 'version' || command === '-v' || command === '--version') {
    const pkg = JSON.parse(await readFile(path.join(PKG_ROOT, 'package.json'), 'utf8'));
    console.log(`ross-infinite/${pkg.version}`);
    return ExitCode.OK;
  }

  try {
    switch (command) {
      case 'init': {
        const target = path.resolve(rest.find((a) => !a.startsWith('-')) || '.');
        await mkdir(path.join(target, '.ross'), { recursive: true });
        const manifest = {
          name: path.basename(target),
          version: '0.1.0',
          private: true,
          dependencies: {}
        };
        const manifestPath = path.join(target, 'ross.package.json');
        let exists = false;
        try {
          await access(manifestPath);
          exists = true;
        } catch {
          exists = false;
        }
        if (exists && !force) throw new Error(`Already initialized: ${manifestPath} (use --force)`);
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        await writeFile(
          path.join(target, '.ross', 'README.md'),
          '# ROSS.CO Infinite project store\n\nContent-addressed artifacts and task cache live here.\n'
        );
        return print(json, { ok: true, target, manifestPath }, () =>
          panel('Init', [`target   ${target}`, `manifest ${manifestPath}`])
        );
      }
      case 'hash': {
        const file = rest.find((a) => !a.startsWith('-'));
        if (!file) throw new Error('usage: ross-infinite hash <file>');
        const abs = path.resolve(file);
        const digest = digestUri(await sha256File(abs));
        return print(json, { file: abs, digest }, () => panel('Hash', [`file   ${abs}`, `digest ${digest}`]));
      }
      case 'transfer': {
        const [source, dest] = rest.filter((a) => !a.startsWith('-'));
        if (!source || !dest) throw new Error('usage: ross-infinite transfer <source> <dest> [--jobs N]');
        const report = await transferFile(path.resolve(source), path.resolve(dest), {
          concurrency: jobs || 4
        });
        return print(json, report, () =>
          panel('Transfer', [
            `bytes   ${report.bytes}`,
            `chunks  ${report.chunks}`,
            `digest  ${report.digest}`,
            `elapsed ${report.elapsedMs} ms`,
            `rate    ${report.mbps} MB/s`
          ])
        );
      }
      case 'resolve': {
        const manifestArg = rest.find((a) => !a.startsWith('-')) || 'ross.package.json';
        const catalogArg = flagValue(rest, '--catalog') || path.join(PKG_ROOT, 'tests/registry-fixture.json');
        const root = process.cwd();
        const manifest = JSON.parse(await readFile(path.resolve(root, manifestArg), 'utf8'));
        const catalog = JSON.parse(await readFile(path.resolve(root, catalogArg), 'utf8'));
        const resolved = resolveDependencies(catalog.packages || catalog, manifest.dependencies || {}, {
          rootName: manifest.name,
          rootVersion: manifest.version
        });
        const written = await writeLockfile(root, resolved.lockfile);
        return print(json, { ...resolved, lockfilePath: written.outPath }, () =>
          panel('Resolve', [
            `packages ${Object.keys(resolved.lockfile.packages).length}`,
            `digest   ${resolved.digest}`,
            `lockfile ${written.outPath}`
          ])
        );
      }
      case 'plan': {
        const target = rest.find((a) => !a.startsWith('-')) || 'default';
        const taskfile = await readTaskfile(process.cwd(), rest);
        const plan = await planTasks(taskfile, target, { root: process.cwd(), jobs });
        return print(json, plan, () =>
          panel('Plan', [
            `target   ${plan.target}`,
            `tasks    ${plan.order.length}`,
            `critical ${plan.criticalPath.path.join(' -> ')}`,
            `width    ${plan.parallelWidth}`
          ])
        );
      }
      case 'run': {
        const target = rest.find((a) => !a.startsWith('-')) || 'default';
        const taskfile = await readTaskfile(process.cwd(), rest);
        const receiptPath = receipt || (capture ? `.ross/receipts/${target}-${Date.now()}.json` : undefined);
        const report = await runTasks(taskfile, target, {
          root: process.cwd(),
          jobs,
          force,
          dryRun,
          capture,
          receipt: receiptPath
        });
        print(json, report, () =>
          panel('Run', [
            `target  ${target}`,
            `ok      ${report.ok}`,
            `passed  ${report.results.filter((r) => r.status === 'passed' || r.status === 'cache-hit').length}`,
            `failed  ${report.results.filter((r) => r.status === 'failed' || r.status === 'blocked').length}`,
            receiptPath ? `receipt ${receiptPath}` : 'receipt (none)'
          ])
        );
        return report.ok ? ExitCode.OK : ExitCode.FAIL;
      }
      case 'analyze': {
        const taskfilePath = rest.find((a) => !a.startsWith('-')) || 'ross.tasks.json';
        const target = rest.filter((a) => !a.startsWith('-'))[1] || 'default';
        const raw = JSON.parse(await readFile(path.resolve(process.cwd(), taskfilePath), 'utf8'));
        const plan = await planTasks(loadTaskfile(raw), target, { root: process.cwd(), jobs });
        return print(json, plan, () =>
          panel('Analyze', [
            `file     ${taskfilePath}`,
            `target   ${target}`,
            `order    ${plan.order.join(', ')}`,
            `critical ${plan.criticalPath.estimateMs} ms est.`
          ])
        );
      }
      case 'policy-check': {
        const [targetPath, policyPath] = rest.filter((a) => !a.startsWith('-'));
        if (!targetPath || !policyPath) throw new Error('usage: ross-infinite policy-check <target.json> <policy.json>');
        const report = await policyCheck(process.cwd(), targetPath, policyPath);
        const code = report.ok ? ExitCode.OK : ExitCode.FAIL;
        print(json, report, () =>
          panel(
            'Policy Check',
            report.findings.map((f) => `${f.status.padEnd(4)} ${f.id} — ${f.message}`)
          )
        );
        return code;
      }
      case 'doctor': {
        const target = path.resolve(rest.find((a) => !a.startsWith('-')) || PKG_ROOT);
        const report = await doctor(target);
        const code = report.ok ? ExitCode.OK : ExitCode.FAIL;
        print(json, report, () =>
          panel(
            'Doctor',
            report.checks.map((c) => `${c.status.padEnd(4)} ${c.id}${c.message ? ` — ${c.message}` : ''}`)
          )
        );
        return code;
      }
      case 'store-put': {
        const file = rest.find((a) => !a.startsWith('-'));
        if (!file) throw new Error('usage: ross-infinite store-put <file>');
        const bytes = await readFile(path.resolve(file));
        const stored = await putBytes(process.cwd(), bytes);
        return print(json, stored, () => panel('Store', [`digest ${stored.digest}`, `path   ${stored.path}`]));
      }
      case 'registry': {
        const port = Number(flagValue(rest, '--port') || process.env.PORT || 4873);
        const dataDir = path.join(process.cwd(), '.ross', 'registry');
        const registry = createRegistry({ dataDir });
        const server = await registry.listen(port);
        console.log(JSON.stringify({ ok: true, service: 'ross-infinite-registry', port, dataDir }, null, 2));
        await new Promise(() => {});
        return ExitCode.OK;
      }
      case 'seo': {
        return runSeo(rest, { json, execute, live });
      }
      case 'chunks': {
        const size = Number(rest.find((a) => !a.startsWith('-')));
        const chunkSize = Number(flagValue(rest, '--chunk') || 1024 * 1024);
        const ranges = planChunkRanges(size, chunkSize);
        return print(json, { size, chunkSize, ranges }, () => panel('Chunks', [`count ${ranges.length}`, `size  ${size}`]));
      }
      default:
        console.error(`Unknown command: ${command}`);
        console.log(helpText());
        return ExitCode.USAGE;
    }
  } catch (error) {
    if (json) console.log(JSON.stringify({ error: error.message }, null, 2));
    else console.error(error.message);
    return ExitCode.FAIL;
  }
}

async function runSeo(args, { json, execute, live }) {
  const sub = args.find((a) => !a.startsWith('-')) || 'plan';
  const configArg =
    args.filter((a) => !a.startsWith('-'))[1] ||
    args.find((a) => a.endsWith('.json') && a.includes('ownership')) ||
    DEFAULT_CONFIG;

  // Allow: seo plan [config] OR seo generate [config]
  const positional = args.filter((a) => !a.startsWith('-'));
  const configPath = positional[1] || (positional[0]?.endsWith('.json') ? positional[0] : configArg);
  const action = ['plan', 'generate', 'prevalidate', 'google', 'indexnow'].includes(positional[0])
    ? positional[0]
    : sub;

  const root = findProjectRoot(process.cwd());
  const { config, abs } = await loadOwnershipConfig(root, configPath === action ? DEFAULT_CONFIG : configPath);

  if (action === 'plan') {
    const plan = ownershipPlan(config);
    return print(json, { configPath: abs, plan }, () =>
      panel('SEO Plan', [
        `owner    ${plan.owner.ownerName}`,
        `asserted ${plan.owner.assertedAt}`,
        `props    ${plan.propertyCount}`,
        `primary  ${plan.primaryProperty.host}`
      ])
    );
  }

  if (action === 'generate') {
    const report = await generateSeoAssets(root, config);
    return print(json, report, () =>
      panel('SEO Generate', [`files  ${report.files.length}`, `dir    ${report.publicDir}`, `receipt ${report.receipt.outPath}`])
    );
  }

  if (action === 'prevalidate') {
    const report = await prevalidateOwnership(root, config, { live });
    const code = report.ok ? ExitCode.OK : ExitCode.FAIL;
    print(json, report, () =>
      panel(
        'SEO Prevalidate',
        [
          `state  ${report.state}`,
          `live   ${report.live}`,
          ...report.checks.map((c) => `${c.status.padEnd(4)} ${c.id} — ${c.detail}`)
        ]
      )
    );
    return code;
  }

  if (action === 'google') {
    const googleAction = positional[2] || positional[1] || 'listSites';
    const normalizedAction = ['listSites', 'addSite', 'submitSitemap'].includes(googleAction)
      ? googleAction
      : 'listSites';
    const report = await googleSearchConsole(root, config, normalizedAction, { execute });
    return print(json, report, () =>
      panel('SEO Google', [
        `action  ${normalizedAction}`,
        `dryRun  ${report.dryRun}`,
        `ok      ${report.ok}`,
        `receipt ${report.receipt.outPath}`
      ])
    );
  }

  if (action === 'indexnow') {
    // If key missing, generate first so dry-run can work with generated key file presence,
    // but indexNowSubmit requires env key — for dry-run allow generate-derived guidance.
    try {
      const report = await indexNowSubmit(root, config, { execute });
      return print(json, report, () =>
        panel('SEO IndexNow', [
          `dryRun   ${report.dryRun}`,
          `endpoint ${report.endpoint}`,
          `urls     ${report.payload.urlList.length}`,
          `receipt  ${report.receipt.outPath}`
        ])
      );
    } catch (error) {
      if (String(error.message).includes('Missing')) {
        // Generate a key into evidence guidance
        const generated = await generateSeoAssets(root, config);
        print(
          json,
          {
            ok: false,
            error: error.message,
            hint: `Export INDEXNOW_KEY=${generated.indexNowKey} or re-run after setting the env var`,
            generated
          },
          () =>
            panel('SEO IndexNow', [
              `error  ${error.message}`,
              `hint   export INDEXNOW_KEY=${generated.indexNowKey}`
            ])
        );
        return ExitCode.FAIL;
      }
      throw error;
    }
  }

  console.error(`Unknown seo action: ${action}`);
  return ExitCode.USAGE;
}

async function readTaskfile(cwd, args) {
  const fromFlag = flagValue(args, '--taskfile');
  const candidates = [
    fromFlag,
    args.find((a) => a.endsWith('ross.tasks.json')),
    'ross.tasks.json',
    path.join(PKG_ROOT, 'ross.tasks.json')
  ].filter(Boolean);
  for (const candidate of candidates) {
    const abs = path.resolve(cwd, candidate);
    try {
      const raw = JSON.parse(await readFile(abs, 'utf8'));
      return loadTaskfile(raw);
    } catch {
      // try next
    }
  }
  // Platform-integrated default taskfile for local smoke when none present in cwd
  return loadTaskfile({
    schemaVersion: 1,
    jobs: 2,
    tasks: {
      default: {
        description: 'Inline smoke default',
        command: 'node -e "console.log(\'ross-infinite ok\')"',
        cache: false
      }
    }
  });
}

function findProjectRoot(start) {
  // Prefer cwd if it has ownership config or is the package root
  return start;
}

function helpText() {
  return `ROSS.CO Infinite — production-candidate CLI

Commands
  init [dir]                 Initialize .ross project store
  hash <file>                SHA-256 digest
  transfer <src> <dest>      Verified resumable transfer
  resolve [manifest]         Deterministic resolve + lockfile
  plan [target]              Task graph plan / critical path
  run [target]               Execute task graph
  analyze <taskfile> [target]
  policy-check <json> <policy>
  doctor [root]              Environment / package diagnostics
  store-put <file>           Put bytes into content-addressed store
  registry [--port N]        Local registry HTTP service
  seo plan|generate|prevalidate|google|indexnow [config]
  version | help

SEO flags
  --live                     Live DNS prevalidation
  --execute                  Perform provider mutations (Google/IndexNow)

General flags
  --json / -j                Machine-readable output
  --force / -f               Force overwrite / ignore cache
  --jobs N                   Concurrency
  --capture                  Capture command stdout/stderr in receipts
  --receipt <path>           Write execution receipt
  --dry-run                  Plan tasks without executing
`;
}

function panel(title, lines) {
  return `${title}\n${lines.map((l) => `  ${l}`).join('\n')}`;
}

function print(json, data, render) {
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(typeof render === 'function' ? render(data) : String(data));
  return ExitCode.OK;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function flagValue(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}
