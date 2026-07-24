import { install } from './install.mjs';
import { runScript, execCommand } from './run.mjs';
import { bench } from './bench.mjs';
import { discoverWorkspaces, loadRootManifest, workspaceByName } from './workspaces.mjs';
import { readLockfile, validateLockfile, LOCKFILE_NAME, LOCKFILE_VERSION } from './lockfile.mjs';
import {
  loadConfig,
  writeConfig,
  initConfig,
  getConfigValue,
  setConfigValue,
  CONFIG_FILE_NAME
} from './config.mjs';
import { listCodes, ExitCode } from './codes.mjs';
import { IP, copyrightBanner, copyrightJson } from './ip.mjs';
import { resolveCommand, listCommands } from './commands.mjs';
import { doctor } from './doctor.mjs';
import { graph, mailStatus } from './graph.mjs';
import { describeApiSurface } from './api.mjs';
import * as ui from './ui.mjs';

export async function runCli(argv) {
  const root = process.cwd();
  const [rawCommand, ...rest] = argv;
  const resolved = resolveCommand(rawCommand);
  const command = resolved?.name || rawCommand;
  const json = rest.includes('--json') || rest.includes('-j');
  const force = rest.includes('--force') || rest.includes('-f');

  if (!command || command === 'help') {
    if (rest[0] && rest[0] !== '--json' && rest[0] !== '-j') {
      return helpOne(rest[0]);
    }
    console.log(ui.helpText());
    return ExitCode.OK;
  }

  if (command === 'version') {
    console.log(`aol/${IP.version}`);
    return ExitCode.OK;
  }

  try {
    switch (command) {
      case 'install': {
        const cfg = await loadConfig(root);
        await install(root, { force: force || cfg.install.force, quiet: cfg.ui.quiet });
        return ExitCode.OK;
      }
      case 'run':
        return await runScript(root, rest);
      case 'exec':
        return await execCommand(root, rest);
      case 'ls':
        return await listWorkspaces(root, json);
      case 'why':
        return await why(root, rest.find((a) => !a.startsWith('-')), json);
      case 'lock':
        return await lockCmd(root, rest);
      case 'bench': {
        const cfg = await loadConfig(root);
        const rounds = Number(rest.find((a) => /^\d+$/.test(a)) || cfg.bench.rounds || 3);
        await bench(root, rounds);
        return ExitCode.OK;
      }
      case 'config':
        return await configCmd(root, rest);
      case 'codes':
        return printJsonOrLines(
          json,
          listCodes(),
          (c) => `${c.code}  exit=${c.exit}  ${c.name} — ${c.message}`
        );
      case 'api':
        return printJsonOrPanel(json, describeApiSurface(), 'AOL Programmatic API', (api) => [
          `package   ${api.package}`,
          `version   ${api.version}`,
          `entry     ${api.entry}`,
          `createAol ${api.createAol.signature}`,
          '',
          'methods:',
          ...api.createAol.methods.map((m) => `  · ${m}`)
        ]);
      case 'copyright':
        if (json) {
          console.log(JSON.stringify(copyrightJson(), null, 2));
        } else {
          console.log(ui.brandLine());
          console.log(copyrightBanner());
          console.log('');
          console.log(ui.panel('Marks', IP.marks.map((m) => `${m.mark} — ${m.kind}`)));
        }
        return ExitCode.OK;
      case 'doctor': {
        const report = await doctor(root);
        if (json) console.log(JSON.stringify(report, null, 2));
        else {
          console.log(ui.brandLine());
          console.log(
            ui.panel('Doctor', [
              report.ok ? 'signal clear' : `${report.failed} issue(s)`,
              ...report.checks.map((c) => `${c.ok ? '✓' : '✖'} ${c.id} — ${c.detail}`)
            ])
          );
        }
        return report.exitCode;
      }
      case 'graph': {
        const g = await graph(root);
        if (json) console.log(JSON.stringify(g, null, 2));
        else {
          console.log(ui.brandLine());
          console.log(ui.youveGot('constellation'));
          const lines = [`root ${g.root}`, `nodes ${g.nodeCount}`, `sectors ${g.sectors.join(', ')}`, ''];
          for (const n of g.nodes) lines.push(`${n.sector.padEnd(12)} ${n.id}`);
          console.log(ui.panel('Constellation Map', lines));
        }
        return ExitCode.OK;
      }
      case 'mail': {
        const status = await mailStatus(root);
        if (json) console.log(JSON.stringify(status, null, 2));
        else {
          console.log(ui.brandLine());
          console.log(ui.youveGot('status'));
          console.log(
            ui.panel('Signal Status', [
              `workspaces   ${status.workspaces}`,
              `sectors      ${status.sectors.join(', ')}`,
              `lockfile     ${status.lockfile ? `${status.lockfileName || 'sealed'} v${status.lockfileVersion || '?'}` : 'missing'}`,
              `format       ${status.lockfileFormat || '—'}`,
              `locked pkgs  ${status.lockedPackages}`,
              `generator    ${status.generator || '—'}`,
              `created      ${status.createdAt || '—'}`
            ])
          );
        }
        return ExitCode.OK;
      }
      case 'whoami': {
        const cfg = await loadConfig(root);
        console.log(ui.brandLine());
        console.log(
          ui.panel('Identity', [
            `product   ${cfg.brand.name} — ${cfg.brand.expansion}`,
            `tagline   ${cfg.brand.tagline}`,
            `aesthetic ${cfg.brand.aesthetic}`,
            `holder    ${cfg.ip.copyrightHolder}`,
            `license   ${cfg.ip.spdxLicense}`,
            `contact   ${IP.contact}`
          ])
        );
        console.log('');
        console.log(cfg.ip.disclaimer);
        return ExitCode.OK;
      }
      case 'commands': {
        const cmds = listCommands();
        if (json) console.log(JSON.stringify(cmds, null, 2));
        else {
          console.log(ui.brandLine());
          console.log(ui.panel('Concept Commands', cmds.map((c) => {
            const aliases = c.aliases.length ? ` (${c.aliases.join(', ')})` : '';
            return `${c.name}${aliases}`;
          })));
          for (const c of cmds) {
            console.log(`  ${c.name.padEnd(12)} ${c.concept}`);
          }
        }
        return ExitCode.OK;
      }
      default: {
        const manifest = await loadRootManifest(root);
        if (manifest.scripts?.[command]) {
          return await runScript(root, [command, ...rest]);
        }
        console.error(ui.error(`Unknown command: ${rawCommand}`));
        console.error(ui.info('Try: aol commands'));
        console.log(ui.helpText());
        return ExitCode.USAGE;
      }
    }
  } catch (err) {
    const exit = err.exitCode ?? ExitCode.ERROR;
    const code = err.code ? `[${err.code}] ` : '';
    console.error(ui.error(`${code}${err.message || String(err)}`));
    if (process.env.AOL_DEBUG) console.error(err);
    return exit;
  }
}

async function listWorkspaces(root, json) {
  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
  if (json) {
    console.log(JSON.stringify(workspaces.map(({ name, version, location, scripts }) => ({ name, version, location, scripts: Object.keys(scripts) })), null, 2));
  } else {
    console.log(ui.brandLine());
    console.log(ui.youveGot(`${workspaces.length} workspaces`));
    console.log(ui.buddyList(workspaces.map((w) => ({ name: w.name, location: w.location, ok: true }))));
  }
  return ExitCode.OK;
}

async function why(root, name, json) {
  if (!name) {
    console.error(ui.error('Usage: aol why <workspace-name>'));
    return ExitCode.USAGE;
  }
  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
  const ws = workspaceByName(workspaces, name);
  if (!ws) {
    console.error(ui.error(`No workspace named ${name}`));
    return ExitCode.WORKSPACE;
  }
  const lock = await readLockfile(root);
  const locked = lock?.packages?.[ws.name];
  const payload = {
    name: ws.name,
    location: ws.location,
    version: ws.version,
    link: `node_modules/${ws.name} → ${ws.location}`,
    fingerprint: locked?.fingerprint || null,
    scripts: Object.keys(ws.scripts),
    private: ws.private
  };
  if (json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(ui.brandLine());
    console.log(
      ui.panel(`Why ${ws.name}`, [
        `location     ${payload.location}`,
        `version      ${payload.version}`,
        `link         ${payload.link}`,
        `fingerprint  ${payload.fingerprint || '(not locked)'}`,
        `scripts      ${payload.scripts.join(', ') || '(none)'}`,
        `private      ${payload.private}`
      ])
    );
  }
  return ExitCode.OK;
}

async function lockCmd(root, args) {
  const json = args.includes('--json') || args.includes('-j');
  const write = args.includes('--write') || args.includes('--seal');

  if (write) {
    const result = await install(root, { force: true });
    if (json) {
      console.log(JSON.stringify({ ok: true, lockfile: LOCKFILE_NAME, linked: result.linked, lock: result.lock }, null, 2));
    } else {
      console.log(ui.info(`Sealed ${LOCKFILE_NAME} · ${result.linked} packages`));
    }
    return ExitCode.OK;
  }

  const lock = await readLockfile(root);
  if (!lock) {
    console.error(ui.error(`Missing ${LOCKFILE_NAME} — run: aol lock --write`));
    return ExitCode.LOCK;
  }
  const validation = validateLockfile(lock);
  if (json) {
    console.log(JSON.stringify({ lockfile: LOCKFILE_NAME, validation, lock }, null, 2));
  } else {
    console.log(ui.brandLine());
    console.log(
      ui.panel('RTPSC-package-lock.json', [
        `format      ${lock.lockfileFormat || '—'}`,
        `version     v${lock.lockfileVersion} (current schema v${LOCKFILE_VERSION})`,
        `generator   ${lock.generator || '—'}`,
        `packages    ${Object.keys(lock.packages || {}).length}`,
        `sectors     ${lock.stats?.sectorCount ?? Object.keys(lock.sectors || {}).length}`,
        `source      ${lock._source || LOCKFILE_NAME}`,
        `created     ${lock.createdAt || '—'}`,
        `validation  ${validation.ok ? 'ok' : validation.issues.join('; ')}`
      ])
    );
  }
  return validation.ok ? ExitCode.OK : ExitCode.LOCK;
}

async function configCmd(root, args) {
  const [action, key, ...valueParts] = args.filter((a) => a !== '--json' && a !== '-j' && a !== '--force' && a !== '-f');
  const json = args.includes('--json') || args.includes('-j');
  const force = args.includes('--force') || args.includes('-f');

  if (!action || action === 'list') {
    const cfg = await loadConfig(root);
    if (json) console.log(JSON.stringify(cfg, null, 2));
    else {
      console.log(ui.brandLine());
      console.log(ui.panel('Configuration', [
        `file       ${CONFIG_FILE_NAME}`,
        `brand      ${cfg.brand.name} — ${cfg.brand.expansion}`,
        `parallel   ${cfg.install.parallel}`,
        `lockfile   ${cfg.install.lockfile}`,
        `bench      ${cfg.bench.rounds} rounds vs ${cfg.bench.compareWith}`,
        `license    ${cfg.ip.spdxLicense}`
      ]));
    }
    return ExitCode.OK;
  }

  if (action === 'init') {
    const file = await initConfig(root, { force });
    console.log(ui.info(`Wrote ${file}`));
    return ExitCode.OK;
  }

  if (action === 'get') {
    if (!key) {
      console.error(ui.error('Usage: aol config get <key>'));
      return ExitCode.USAGE;
    }
    const value = getConfigValue(await loadConfig(root), key);
    if (json) console.log(JSON.stringify({ key, value }, null, 2));
    else console.log(value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value));
    return ExitCode.OK;
  }

  if (action === 'set') {
    if (!key || valueParts.length === 0) {
      console.error(ui.error('Usage: aol config set <key> <value>'));
      return ExitCode.USAGE;
    }
    const next = setConfigValue(await loadConfig(root), key, valueParts.join(' '));
    await writeConfig(root, next);
    console.log(ui.info(`Set ${key}`));
    return ExitCode.OK;
  }

  console.error(ui.error('Usage: aol config <list|get|set|init>'));
  return ExitCode.USAGE;
}

function helpOne(name) {
  const cmd = resolveCommand(name);
  if (!cmd) {
    console.error(ui.error(`Unknown command: ${name}`));
    return ExitCode.USAGE;
  }
  console.log(ui.brandLine());
  console.log(
    ui.panel(cmd.name, [
      `usage      ${cmd.usage}`,
      `aliases    ${cmd.aliases.join(', ') || '—'}`,
      `category   ${cmd.category}`,
      `concept    ${cmd.concept}`
    ])
  );
  return ExitCode.OK;
}

function printJsonOrLines(json, rows, lineFn) {
  if (json) console.log(JSON.stringify(rows, null, 2));
  else {
    console.log(ui.brandLine());
    for (const row of rows) console.log(`  ${lineFn(row)}`);
  }
  return ExitCode.OK;
}

function printJsonOrPanel(json, data, title, linesFn) {
  if (json) console.log(JSON.stringify(data, null, 2));
  else {
    console.log(ui.brandLine());
    console.log(ui.panel(title, linesFn(data)));
  }
  return ExitCode.OK;
}

export { install, runScript, execCommand, bench };
