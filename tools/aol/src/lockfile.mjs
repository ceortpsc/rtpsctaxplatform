import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const LOCKFILE_NAME = 'aol.lock.json';

export function buildLockfile({ rootName, rootVersion, workspaces }) {
  const packages = {};
  for (const ws of workspaces) {
    packages[ws.name] = {
      version: ws.version,
      location: ws.location,
      link: true,
      fingerprint: fingerprint(ws)
    };
  }
  return {
    name: rootName,
    version: rootVersion,
    lockfileVersion: 1,
    generator: 'aol@0.1.0',
    createdAt: new Date().toISOString(),
    packages
  };
}

export function fingerprint(ws) {
  const payload = JSON.stringify({
    name: ws.name,
    version: ws.version,
    location: ws.location,
    dependencies: ws.dependencies,
    devDependencies: ws.devDependencies,
    scripts: ws.scripts
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export async function writeLockfile(root, lock) {
  const file = path.join(root, LOCKFILE_NAME);
  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`);
  return file;
}

export async function readLockfile(root) {
  const file = path.join(root, LOCKFILE_NAME);
  try {
    await access(file);
  } catch {
    return null;
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

export function lockMatches(lock, workspaces) {
  if (!lock?.packages) return false;
  const names = new Set(workspaces.map((w) => w.name));
  const locked = Object.keys(lock.packages);
  if (locked.length !== names.size) return false;
  for (const ws of workspaces) {
    const entry = lock.packages[ws.name];
    if (!entry || entry.location !== ws.location || entry.fingerprint !== fingerprint(ws)) {
      return false;
    }
  }
  return true;
}
