import { spawn } from 'node:child_process';
import { discoverWorkspaces, loadRootManifest, workspaceByName } from './workspaces.mjs';
import * as ui from './ui.mjs';

/**
 * Script runner — bypasses npm's process tax.
 * Resolves scripts from root or `-w` workspace package.json and execs via shell.
 */
export async function runScript(root, args, options = {}) {
  const { workspace, script, scriptArgs } = parseRunArgs(args);
  if (!script) {
    console.error(ui.error('Usage: aol run [-w <workspace>] <script> [-- args...]'));
    return 1;
  }

  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);

  let cwd = root;
  let scripts = manifest.scripts || {};
  let label = manifest.name || 'root';

  if (workspace) {
    const ws = workspaceByName(workspaces, workspace);
    if (!ws) {
      console.error(ui.error(`Workspace not found: ${workspace}`));
      return 1;
    }
    cwd = ws.dir;
    scripts = ws.scripts;
    label = ws.name;
  }

  const command = scripts[script];
  if (!command) {
    console.error(ui.error(`Missing script "${script}" in ${label}`));
    const available = Object.keys(scripts);
    if (available.length) {
      console.error(ui.info(`Available: ${available.join(', ')}`));
    }
    return 1;
  }

  if (!options.quiet) {
    console.log(ui.brandLine());
    console.log(ui.info(`${label} → ${script}`));
  }

  const full = scriptArgs.length ? `${command} ${scriptArgs.join(' ')}` : command;
  return exec(full, {
    cwd,
    env: {
      ...process.env,
      AOL: '1',
      AOL_VERSION: '0.1.0',
      npm_lifecycle_event: script
    }
  });
}

export async function execCommand(root, args) {
  const { workspace, scriptArgs } = parseRunArgs(args, { allowEmptyScript: true });
  if (!scriptArgs.length) {
    console.error(ui.error('Usage: aol exec -w <workspace> -- <command>'));
    return 1;
  }
  let cwd = root;
  if (workspace) {
    const manifest = await loadRootManifest(root);
    const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
    const ws = workspaceByName(workspaces, workspace);
    if (!ws) {
      console.error(ui.error(`Workspace not found: ${workspace}`));
      return 1;
    }
    cwd = ws.dir;
  }
  return exec(scriptArgs.join(' '), { cwd, env: { ...process.env, AOL: '1' } });
}

function parseRunArgs(args, { allowEmptyScript = false } = {}) {
  const out = { workspace: null, script: null, scriptArgs: [] };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '-w' || a === '--workspace') {
      out.workspace = args[++i];
      i += 1;
      continue;
    }
    if (a === '--') {
      out.scriptArgs.push(...args.slice(i + 1));
      break;
    }
    if (!out.script && !allowEmptyScript) {
      out.script = a;
      const rest = args.slice(i + 1);
      const dd = rest.indexOf('--');
      out.scriptArgs = dd >= 0 ? rest.slice(dd + 1) : rest.filter((x) => x !== '--');
      break;
    }
    out.scriptArgs.push(a);
    i += 1;
  }
  return out;
}

function exec(command, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      env,
      stdio: 'inherit',
      shell: true
    });
    child.on('exit', (code, signal) => {
      if (signal) resolve(1);
      else resolve(code ?? 0);
    });
  });
}
