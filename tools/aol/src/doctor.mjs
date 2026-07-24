import { access, lstat, readlink } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, CONFIG_FILE_NAME } from './config.mjs';
import { discoverWorkspaces, loadRootManifest } from './workspaces.mjs';
import { readLockfile, lockMatches, validateLockfile, LOCKFILE_NAME } from './lockfile.mjs';
import { IP } from './ip.mjs';
import { ExitCode } from './codes.mjs';

/**
 * Doctor — constellation health diagnostics.
 */
export async function doctor(root = process.cwd()) {
  const checks = [];
  const push = (id, ok, detail) => checks.push({ id, ok, detail });

  // config
  try {
    const cfg = await loadConfig(root);
    push('config.load', true, `brand=${cfg.brand.name}`);
    try {
      await access(path.join(root, CONFIG_FILE_NAME));
      push('config.file', true, CONFIG_FILE_NAME);
    } catch {
      push('config.file', true, 'defaults only (file optional)');
    }
  } catch (err) {
    push('config.load', false, err.message);
  }

  // workspaces + links
  let workspaces = [];
  try {
    const manifest = await loadRootManifest(root);
    workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
    push('workspaces.discover', workspaces.length > 0, `${workspaces.length} buddies`);
  } catch (err) {
    push('workspaces.discover', false, err.message);
  }

  let broken = 0;
  for (const ws of workspaces) {
    const linkPath = path.join(root, 'node_modules', ...ws.name.split('/'));
    try {
      const st = await lstat(linkPath);
      if (!st.isSymbolicLink()) {
        broken += 1;
        continue;
      }
      await readlink(linkPath);
    } catch {
      broken += 1;
    }
  }
  push('workspaces.links', broken === 0 && workspaces.length > 0, broken === 0 ? 'all links healthy' : `${broken} broken`);

  // lockfile (canonical RTPSC-package-lock.json)
  const lock = await readLockfile(root);
  if (!lock) {
    push('lockfile', false, `missing — run aol install (${LOCKFILE_NAME})`);
  } else {
    const validation = validateLockfile(lock);
    push(
      'lockfile.format',
      validation.ok,
      validation.ok
        ? `${lock.lockfileFormat || 'lock'} v${lock.lockfileVersion} via ${lock._source || LOCKFILE_NAME}`
        : validation.issues.join('; ')
    );
    const match = lockMatches(lock, workspaces);
    push('lockfile.fingerprints', match, match ? 'fingerprints + integrity sealed' : 'stale fingerprints');
    push(
      'lockfile.canonical',
      lock._source === LOCKFILE_NAME || lock.lockfileFormat === 'RTPSC-package-lock',
      lock._source === LOCKFILE_NAME ? LOCKFILE_NAME : `legacy ${lock._source} — re-run install`
    );
  }

  // IP assets
  for (const rel of ['LICENSE', 'tools/aol/NOTICE', 'docs/aol-intellectual-property.md']) {
    try {
      await access(path.join(root, rel));
      push(`ip.${rel}`, true, 'present');
    } catch {
      push(`ip.${rel}`, false, 'missing');
    }
  }

  push('ip.product', true, IP.productFull);

  const failed = checks.filter((c) => !c.ok);
  return {
    ok: failed.length === 0,
    exitCode: failed.length === 0 ? ExitCode.OK : ExitCode.DOCTOR,
    product: IP.productFull,
    checks,
    failed: failed.length,
    passed: checks.length - failed.length
  };
}
