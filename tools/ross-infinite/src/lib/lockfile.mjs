import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveDependencies } from './resolver.mjs';
import { sha256, digestUri } from './hash.mjs';

export async function writeLockfile(projectRoot, lockfile, fileName = 'ross.lock.json') {
  const outPath = path.join(projectRoot, fileName);
  await mkdir(projectRoot, { recursive: true });
  const body = `${JSON.stringify(lockfile, null, 2)}\n`;
  await writeFile(outPath, body, 'utf8');
  return { outPath, digest: digestUri(sha256(body)) };
}

export async function readLockfile(projectRoot, fileName = 'ross.lock.json') {
  const outPath = path.join(projectRoot, fileName);
  const body = await readFile(outPath, 'utf8');
  return { outPath, lockfile: JSON.parse(body), digest: digestUri(sha256(body)) };
}

export function buildLockfileFromManifest(manifest, catalog) {
  const requests = manifest.dependencies || {};
  return resolveDependencies(catalog, requests, {
    rootName: manifest.name || 'root',
    rootVersion: manifest.version || '0.0.0'
  });
}
