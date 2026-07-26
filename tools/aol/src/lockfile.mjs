import { readFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { IP } from './ip.mjs';

/** Canonical RTPSC platform lockfile. */
export const LOCKFILE_NAME = 'RTPSC-package-lock.json';

/** Legacy AOL lockfile — migrated on read, removed after successful write. */
export const LEGACY_LOCKFILE_NAME = 'aol.lock.json';

export const LOCKFILE_VERSION = 2;

/**
 * Build the RTPSC package lock — seals the workspace constellation.
 */
export function buildLockfile({ rootName, rootVersion, workspaces, config }) {
  const packages = {};
  const sectors = {};

  for (const ws of workspaces) {
    const sector = (ws.location || '').split('/')[0] || 'root';
    const entry = {
      name: ws.name,
      version: ws.version,
      location: ws.location,
      sector,
      private: Boolean(ws.private),
      link: true,
      linkTarget: ws.location,
      fingerprint: fingerprint(ws),
      integrity: integrity(ws),
      scripts: Object.keys(ws.scripts || {}),
      dependencies: ws.dependencies || {},
      devDependencies: ws.devDependencies || {}
    };
    packages[ws.name] = entry;
    if (!sectors[sector]) sectors[sector] = [];
    sectors[sector].push(ws.name);
  }

  for (const key of Object.keys(sectors)) {
    sectors[key].sort();
  }

  return {
    name: rootName,
    version: rootVersion,
    lockfileVersion: LOCKFILE_VERSION,
    lockfileFormat: 'RTPSC-package-lock',
    generator: `aol@${IP.version}`,
    platform: 'rtpsctaxplatform',
    createdAt: new Date().toISOString(),
    engines: { node: '>=22' },
    packageManager: 'aol@0.1.0',
    copyright: IP.copyrightLine,
    product: IP.productFull,
    disclaimer: IP.disclaimer,
    requires: true,
    stats: {
      workspaceCount: workspaces.length,
      sectorCount: Object.keys(sectors).length,
      linkedCount: workspaces.length
    },
    sectors,
    packages,
    meta: {
      configLockfile: config?.install?.lockfile || LOCKFILE_NAME,
      aesthetic: config?.brand?.aesthetic || 'instant-messenger-signal',
      sealedBy: 'Adaptive Optimized Linker'
    }
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

/** Full sha256 integrity string (RTPSC lock v2). */
export function integrity(ws) {
  const payload = JSON.stringify({
    name: ws.name,
    version: ws.version,
    location: ws.location,
    dependencies: ws.dependencies || {},
    devDependencies: ws.devDependencies || {},
    scripts: ws.scripts || {}
  });
  return `sha256-${createHash('sha256').update(payload).digest('hex')}`;
}

export function lockfilePath(root, name = LOCKFILE_NAME) {
  return path.join(root, name);
}

export async function writeLockfile(root, lock, options = {}) {
  const name = options.name || LOCKFILE_NAME;
  const file = lockfilePath(root, name);
  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`);

  // Drop legacy aol.lock.json once the canonical RTPSC lock is sealed.
  if (name === LOCKFILE_NAME) {
    try {
      await rm(lockfilePath(root, LEGACY_LOCKFILE_NAME), { force: true });
    } catch {
      // ignore
    }
  }
  return file;
}

export async function readLockfile(root) {
  for (const name of [LOCKFILE_NAME, LEGACY_LOCKFILE_NAME]) {
    const file = lockfilePath(root, name);
    try {
      await access(file);
    } catch {
      continue;
    }
    const raw = JSON.parse(await readFile(file, 'utf8'));
    return normalizeLock(raw, name);
  }
  return null;
}

/** Normalize v1 aol.lock.json or v2 RTPSC-package-lock into a comparable shape. */
export function normalizeLock(raw, sourceName = LOCKFILE_NAME) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    lockfileFormat: raw.lockfileFormat || (sourceName === LOCKFILE_NAME ? 'RTPSC-package-lock' : 'aol.lock'),
    packages: raw.packages || {},
    _source: sourceName
  };
}

export function lockMatches(lock, workspaces) {
  if (!lock?.packages) return false;
  const locked = Object.keys(lock.packages);
  if (locked.length !== workspaces.length) return false;
  for (const ws of workspaces) {
    const entry = lock.packages[ws.name];
    if (!entry) return false;
    if (entry.location !== ws.location) return false;
    if (entry.fingerprint !== fingerprint(ws)) return false;
    // v2 integrity optional for legacy locks
    if (entry.integrity && entry.integrity !== integrity(ws)) return false;
  }
  return true;
}

export function validateLockfile(lock) {
  const issues = [];
  if (!lock) {
    issues.push('lockfile missing');
    return { ok: false, issues };
  }
  if (![1, 2].includes(lock.lockfileVersion)) {
    issues.push(`unsupported lockfileVersion: ${lock.lockfileVersion}`);
  }
  if (!lock.packages || typeof lock.packages !== 'object') {
    issues.push('packages map missing');
  } else {
    for (const [name, entry] of Object.entries(lock.packages)) {
      if (!entry.location) issues.push(`${name}: missing location`);
      if (!entry.fingerprint) issues.push(`${name}: missing fingerprint`);
      if (lock.lockfileVersion >= 2 && !entry.integrity) {
        issues.push(`${name}: missing integrity (v2)`);
      }
    }
  }
  if (lock.lockfileFormat && lock.lockfileFormat !== 'RTPSC-package-lock' && lock.lockfileFormat !== 'aol.lock') {
    issues.push(`unknown lockfileFormat: ${lock.lockfileFormat}`);
  }
  return { ok: issues.length === 0, issues };
}
