import { mkdir, writeFile, readFile, access, rename } from 'node:fs/promises';
import path from 'node:path';
import { sha256, digestUri } from './hash.mjs';
import { stableStringify } from './canonical.mjs';

/**
 * Content-addressed store under .ross/store/sha256/<ab>/<rest>
 */
export function storeRoot(projectRoot) {
  return path.join(projectRoot, '.ross', 'store');
}

export function objectPath(root, digestHex) {
  const hex = digestHex.replace(/^sha256:/, '');
  return path.join(storeRoot(root), 'sha256', hex.slice(0, 2), hex.slice(2));
}

export async function putBytes(root, bytes, { ext = '' } = {}) {
  const hex = sha256(bytes);
  const dest = objectPath(root, hex) + ext;
  await mkdir(path.dirname(dest), { recursive: true });
  try {
    await access(dest);
  } catch {
    const tmp = `${dest}.tmp-${process.pid}`;
    await writeFile(tmp, bytes);
    await rename(tmp, dest);
  }
  return { digest: digestUri(hex), path: dest, bytes: bytes.length };
}

export async function putJson(root, value) {
  const body = Buffer.from(stableStringify(value), 'utf8');
  return putBytes(root, body, { ext: '.json' });
}

export async function getBytes(root, digestHex) {
  const dest = objectPath(root, digestHex);
  return readFile(dest);
}

export async function hasObject(root, digestHex) {
  try {
    await access(objectPath(root, digestHex));
    return true;
  } catch {
    return false;
  }
}
