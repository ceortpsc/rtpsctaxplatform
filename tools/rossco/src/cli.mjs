import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IP, copyrightBanner, copyrightJson } from './ip.mjs';
import { lifecycleMap, planRelease, scopeRelease, LIFECYCLE_STAGES } from './lifecycle.mjs';
import { infiniteTransfer, transferGraph } from './transfer.mjs';
import { loadConfig, initConfig, CONFIG_FILE_NAME } from './config.mjs';
import { registerProduct } from './register.mjs';
import { ensurePresenceSite, presenceStatus } from './presence.mjs';
import { emitSeo } from './seo.mjs';
import { validatePrototype, verifyPrototype } from './validate.mjs';
import * as ui from './ui.mjs';

const ExitCode = { OK: 0, USAGE: 2, FAIL: 1 };

export async function runCli(argv) {
  const root = process.cwd();
  const [rawCommand, ...rest] = argv;
  const command = rawCommand || 'help';
  const json = rest.includes('--json') || rest.includes('-j');
  const force = rest.includes('--force') || rest.includes('-f');

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(ui.helpText());
    return ExitCode.OK;
  }

  if (command === 'version' || command === '-v' || command === '--version') {
    console.log(`rossco/${IP.version}`);
    return ExitCode.OK;
  }

  try {
    switch (command) {
      case 'install':
      case 'transfer':
      case 'dial': {
        const report = await infiniteTransfer(root, { force, quiet: false });
        return print(json, report, () =>
          ui.panel('ROSS.CO Infinite Transfer', [
            `workspaces  ${report.workspaceCount}`,
            `elapsed     ${report.elapsedMs} ms`,
            `rate        ${report.mbps} Mbps (estimated)`,
            `mode        ${report.mode}`,
            `cacheHit    ${report.install.cacheHit}`,
            report.note
          ])
        );
      }
      case 'lifecycle':
      case 'map':
        return print(json, lifecycleMap(), () =>
          ui.panel(
            'Lifecycle Map',
            LIFECYCLE_STAGES.map((stage, index) => `${String(index + 1).padStart(2, '0')}  ${stage.id.padEnd(10)} ${stage.title}`)
          )
        );
      case 'plan':
        return print(json, planRelease(), (plan) =>
          ui.panel('Plan', [...plan.goals.map((g) => `• ${g}`), `velocity  ${plan.velocityTarget.mode}`])
        );
      case 'scope':
        return print(json, scopeRelease(), (scope) =>
          ui.panel('Scope', [
            'in-scope:',
            ...scope.inScope.map((item) => `  + ${item}`),
            'deferred:',
            ...scope.deferred.map((item) => `  - ${item}`)
          ])
        );
      case 'stage': {
        const config = await loadConfig(root);
        const artifact = {
          stage: 'stage',
          frozenAt: new Date().toISOString(),
          transferMode: config.transfer.mode,
          candidates: config.lifecycle.stages,
          note: 'Staging freeze for prototype constellation'
        };
        return print(json, artifact, () => ui.panel('Stage Freeze', [`mode  ${artifact.transferMode}`, `at    ${artifact.frozenAt}`]));
      }
      case 'test': {
        const code = await runNodeTest(root);
        const payload = { stage: 'test', exitCode: code, command: 'node --test tests/rossco*.test.mjs tests/refund-optimization*.test.mjs' };
        if (json) console.log(JSON.stringify(payload, null, 2));
        else console.log(ui.panel('Test', [`exit  ${code}`, payload.command]));
        return code === 0 ? ExitCode.OK : ExitCode.FAIL;
      }
      case 'validate': {
        const report = await validatePrototype(root);
        if (json) console.log(JSON.stringify(report, null, 2));
        else {
          console.log(
            ui.panel(
              'Validate',
              report.checks.map((check) => `${check.status.padEnd(4)} ${check.id}${check.message ? ` — ${check.message}` : ''}`)
            )
          );
        }
        return report.ok ? ExitCode.OK : ExitCode.FAIL;
      }
      case 'verify': {
        const report = await verifyPrototype(root, { transferFn: infiniteTransfer });
        return print(json, report, () =>
          ui.panel('Verify', [
            `validation  ${report.validation.ok ? 'pass' : 'fail'}`,
            `transfer    ${report.transfer ? `${report.transfer.elapsedMs} ms / ${report.transfer.mbps} Mbps` : report.transferError}`,
            `ok          ${report.ok}`
          ])
        );
      }
      case 'register': {
        const result = await registerProduct(root);
        return print(json, result, () =>
          ui.panel('Registered', [`product  ${result.entry.product}`, `version  ${result.entry.version}`, `file     ${result.outPath}`])
        );
      }
      case 'copyright':
      case 'ip':
        return print(json, copyrightJson(), () => copyrightBanner());
      case 'presence': {
        const ensured = await ensurePresenceSite(root);
        const status = await presenceStatus(root);
        return print(json, { ...ensured, status }, () =>
          ui.panel('Presence', [`site   ${ensured.siteRoot}`, `files  ${ensured.files.join(', ')}`, `domain ${status.domain}`])
        );
      }
      case 'seo': {
        const report = await emitSeo(root);
        return print(json, report, () =>
          ui.panel('SEO', [`domain     ${report.domain}`, `canonical  ${report.canonical}`, ...report.checklist.map((item) => `✓ ${item}`)])
        );
      }
      case 'graph': {
        const graph = await transferGraph(root);
        return print(json, graph, () => ui.panel('Transfer Graph', [`nodes  ${graph.nodes.length}`, `edges  ${graph.edges.length}`]));
      }
      case 'config': {
        if (rest[0] === 'init') {
          const cfg = await initConfig(root);
          return print(json, cfg, () => ui.panel('Config', [`wrote  ${CONFIG_FILE_NAME}`]));
        }
        const cfg = await loadConfig(root);
        return print(json, cfg, () => ui.panel('Config', [`brand  ${cfg.brand.name}`, `mode   ${cfg.transfer.mode}`, `domain ${cfg.brand.domain}`]));
      }
      case 'doctor': {
        const validation = await validatePrototype(root);
        const presence = await presenceStatus(root);
        const report = { validation, presence, linker: 'aol', ok: validation.ok && presence.missing.length === 0 };
        return print(json, report, () =>
          ui.panel('Doctor', [
            `validate   ${validation.ok ? 'ok' : 'fail'}`,
            `presence   ${presence.missing.length === 0 ? 'ok' : `missing ${presence.missing.join(',')}`}`,
            `delegate   aol`
          ])
        );
      }
      case 'commands':
        return print(
          json,
          [
            'install', 'transfer', 'lifecycle', 'map', 'plan', 'scope', 'stage', 'test',
            'validate', 'verify', 'register', 'copyright', 'presence', 'seo', 'graph',
            'config', 'doctor', 'version', 'help'
          ],
          (list) => ui.panel('Commands', list)
        );
      default:
        console.error(`Unknown command: ${command}`);
        console.log(ui.helpText());
        return ExitCode.USAGE;
    }
  } catch (error) {
    if (json) console.log(JSON.stringify({ error: error.message }, null, 2));
    else console.error(error.message);
    return ExitCode.FAIL;
  }
}

function print(json, data, render) {
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(typeof render === 'function' ? render(data) : String(data));
  return ExitCode.OK;
}

function runNodeTest(root) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--test', 'tests/rossco-itr.test.mjs', 'tests/refund-optimization.test.mjs'],
      { cwd: root, stdio: 'inherit' }
    );
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export function cliPath() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '../bin/rossco.mjs');
}
