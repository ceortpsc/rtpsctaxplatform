import { discoverWorkspaces, loadRootManifest } from './workspaces.mjs';
import { readLockfile, fingerprint, integrity, LOCKFILE_NAME } from './lockfile.mjs';

/** Companion ledger written beside RTPSC-package-lock.json. */
export const FOOTPRINTS_FILE = 'RTPSC-footprints.json';

/**
 * Collect all RTPSC footprints (fingerprints + integrity) across the constellation.
 */
export async function listFootprints(root = process.cwd()) {
  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
  const lock = await readLockfile(root);

  const entries = workspaces.map((ws) => {
    const locked = lock?.packages?.[ws.name];
    const liveFingerprint = fingerprint(ws);
    const liveIntegrity = integrity(ws);
    const sealedFingerprint = locked?.fingerprint || null;
    const sealedIntegrity = locked?.integrity || null;
    const match =
      Boolean(sealedFingerprint) &&
      sealedFingerprint === liveFingerprint &&
      (!sealedIntegrity || sealedIntegrity === liveIntegrity);

    return {
      name: ws.name,
      version: ws.version,
      location: ws.location,
      sector: (ws.location || '').split('/')[0] || 'root',
      footprint: sealedFingerprint || liveFingerprint,
      fingerprint: sealedFingerprint || liveFingerprint,
      integrity: sealedIntegrity || liveIntegrity,
      liveFingerprint,
      liveIntegrity,
      sealed: Boolean(locked),
      match,
      status: !locked ? 'unsealed' : match ? 'sealed' : 'drift'
    };
  });

  entries.sort((a, b) => a.name.localeCompare(b.name));

  const sealed = entries.filter((e) => e.status === 'sealed').length;
  const drift = entries.filter((e) => e.status === 'drift').length;
  const unsealed = entries.filter((e) => e.status === 'unsealed').length;

  return {
    lockfile: LOCKFILE_NAME,
    lockfilePresent: Boolean(lock),
    lockfileFormat: lock?.lockfileFormat || null,
    lockfileVersion: lock?.lockfileVersion || null,
    count: entries.length,
    sealed,
    drift,
    unsealed,
    ok: drift === 0 && unsealed === 0 && entries.length > 0,
    footprints: entries
  };
}

/** Compact ledger lines for CLI / artifacts. */
export function formatFootprintLedger(report) {
  return report.footprints.map(
    (e) => `${e.footprint}  ${e.status.padEnd(8)}  ${e.name.padEnd(36)}  ${e.location}`
  );
}
