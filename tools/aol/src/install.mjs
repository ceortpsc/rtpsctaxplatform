import { mkdir, rm, symlink, lstat, readlink } from 'node:fs/promises';
import path from 'node:path';
import { discoverWorkspaces, loadRootManifest } from './workspaces.mjs';
import { buildLockfile, writeLockfile, readLockfile, lockMatches } from './lockfile.mjs';
import * as ui from './ui.mjs';

/**
 * Parallel workspace linker — the AOL fast path.
 * Creates node_modules/<name> → workspace dir symlinks concurrently.
 * Skips network resolution when the graph is workspace-local only.
 */
export async function install(root = process.cwd(), options = {}) {
  const started = performance.now();
  const quiet = Boolean(options.quiet);
  const force = Boolean(options.force);

  const manifest = await loadRootManifest(root);
  const patterns = manifest.workspaces || [];
  const workspaces = await discoverWorkspaces(root, patterns);

  if (!quiet) {
    console.log(ui.brandLine());
    console.log(ui.handshake(1, 4, 'scanning constellation'));
  }

  const existingLock = await readLockfile(root);
  const nm = path.join(root, 'node_modules');
  await mkdir(nm, { recursive: true });

  if (!force && existingLock && lockMatches(existingLock, workspaces) && (await linksHealthy(nm, workspaces))) {
    const ms = performance.now() - started;
    if (!quiet) {
      console.log(ui.handshake(4, 4, 'cache hit — signal locked'));
      console.log(ui.success(ms, { linked: workspaces.length, kind: 'packages', scripts: true, speedup: null }));
    }
    return { ms, linked: workspaces.length, workspaces, cached: true };
  }

  if (!quiet) console.log(ui.handshake(2, 4, 'opening parallel tunnels'));

  // Wipe stale scoped / flat links we own, then recreate in parallel.
  await clearManagedLinks(nm, workspaces);

  if (!quiet) console.log(ui.handshake(3, 4, `linking ${workspaces.length} buddies`));

  await Promise.all(workspaces.map((ws) => linkWorkspace(nm, ws, root)));

  const lock = buildLockfile({
    rootName: manifest.name,
    rootVersion: manifest.version,
    workspaces
  });
  await writeLockfile(root, lock);

  const ms = performance.now() - started;
  if (!quiet) {
    console.log(ui.handshake(4, 4, 'lockfile sealed'));
    console.log(ui.buddyList(workspaces.map((w) => ({ name: w.name, location: w.location, ok: true }))));
    console.log(ui.success(ms, { linked: workspaces.length, kind: 'packages', scripts: true }));
  }
  return { ms, linked: workspaces.length, workspaces, cached: false };
}

async function linkWorkspace(nm, ws, root) {
  const target = path.resolve(root, ws.dir);
  // Support scoped packages: @rtp/foo → node_modules/@rtp/foo
  const linkPath = path.join(nm, ...ws.name.split('/'));
  await mkdir(path.dirname(linkPath), { recursive: true });
  try {
    await rm(linkPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
  // Relative symlink keeps the tree portable.
  const rel = path.relative(path.dirname(linkPath), target);
  await symlink(rel, linkPath, 'junction');
}

async function clearManagedLinks(nm, workspaces) {
  await Promise.all(
    workspaces.map(async (ws) => {
      const linkPath = path.join(nm, ...ws.name.split('/'));
      try {
        await rm(linkPath, { recursive: true, force: true });
      } catch {
        // ignore
      }
    })
  );
}

async function linksHealthy(nm, workspaces) {
  for (const ws of workspaces) {
    const linkPath = path.join(nm, ...ws.name.split('/'));
    try {
      const st = await lstat(linkPath);
      if (!st.isSymbolicLink()) return false;
      await readlink(linkPath);
    } catch {
      return false;
    }
  }
  return true;
}
