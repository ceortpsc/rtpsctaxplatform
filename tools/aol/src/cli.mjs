import { install } from './install.mjs';
import { runScript, execCommand } from './run.mjs';
import { bench } from './bench.mjs';
import { discoverWorkspaces, loadRootManifest, workspaceByName } from './workspaces.mjs';
import { readLockfile } from './lockfile.mjs';
import * as ui from './ui.mjs';

export async function runCli(argv) {
  const root = process.cwd();
  const [command, ...rest] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(ui.helpText());
    return 0;
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    console.log('aol/0.1.0');
    return 0;
  }

  try {
    switch (command) {
      case 'i':
      case 'install':
      case 'link': {
        const force = rest.includes('--force') || rest.includes('-f');
        await install(root, { force });
        return 0;
      }
      case 'run': {
        return await runScript(root, rest);
      }
      case 'exec': {
        return await execCommand(root, rest);
      }
      case 'ls':
      case 'list': {
        return await listWorkspaces(root);
      }
      case 'why': {
        return await why(root, rest[0]);
      }
      case 'bench': {
        const rounds = Number(rest.find((a) => /^\d+$/.test(a)) || 3);
        await bench(root, rounds);
        return 0;
      }
      default: {
        // npm-compat: `aol test` → `aol run test`
        const manifest = await loadRootManifest(root);
        if (manifest.scripts?.[command]) {
          return await runScript(root, [command, ...rest]);
        }
        console.error(ui.error(`Unknown command: ${command}`));
        console.log(ui.helpText());
        return 1;
      }
    }
  } catch (err) {
    console.error(ui.error(err.message || String(err)));
    if (process.env.AOL_DEBUG) console.error(err);
    return 1;
  }
}

async function listWorkspaces(root) {
  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
  console.log(ui.brandLine());
  console.log(ui.youveGot(`${workspaces.length} workspaces`));
  console.log(ui.buddyList(workspaces.map((w) => ({ name: w.name, location: w.location, ok: true }))));
  return 0;
}

async function why(root, name) {
  if (!name) {
    console.error(ui.error('Usage: aol why <workspace-name>'));
    return 1;
  }
  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
  const ws = workspaceByName(workspaces, name);
  if (!ws) {
    console.error(ui.error(`No workspace named ${name}`));
    return 1;
  }
  const lock = await readLockfile(root);
  const locked = lock?.packages?.[ws.name];
  console.log(ui.brandLine());
  console.log(
    ui.panel(`Why ${ws.name}`, [
      `location     ${ws.location}`,
      `version      ${ws.version}`,
      `link         node_modules/${ws.name} → ${ws.location}`,
      `fingerprint  ${locked?.fingerprint || '(not locked)'}`,
      `scripts      ${Object.keys(ws.scripts).join(', ') || '(none)'}`,
      `private      ${ws.private}`
    ])
  );
  return 0;
}

export { install, runScript, execCommand, bench };
