/**
 * @rtp/operational-seed — wire the full application from real firm/env/topology
 * configuration. Does not invent demo taxpayers, fake invoices, or placeholder clients.
 */

import { evaluateEnvironmentProtection, PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';
import { createSecureTunnelAdapter } from '../../secure-tunnel/src/index.mjs';
import { loadFirmIdentity } from './firm.mjs';
import { resolveServiceWiring, serviceBaseUrl } from './wiring.mjs';
import { loadOperationalCatalogs, UNFUNDED_REFUND_INQUIRIES } from './catalog.mjs';
import { applyOperationalSeed, hydrateCrmFromSnapshot } from './apply.mjs';
import {
  resolveOperationalDataDir,
  resolveSeedManifestPath,
  writeJsonFile,
  readJsonFile,
  createJsonDocumentStore
} from './persist.mjs';

export {
  loadFirmIdentity,
  resolveServiceWiring,
  serviceBaseUrl,
  loadOperationalCatalogs,
  UNFUNDED_REFUND_INQUIRIES,
  applyOperationalSeed,
  hydrateCrmFromSnapshot,
  resolveOperationalDataDir,
  resolveSeedManifestPath,
  writeJsonFile,
  readJsonFile,
  createJsonDocumentStore
};

/**
 * Build the full operational seed snapshot (serializable, secrets redacted).
 */
export function buildOperationalSeed({ env = process.env, now = () => new Date().toISOString() } = {}) {
  const firm = loadFirmIdentity(env);
  const wiring = resolveServiceWiring(env);
  const catalogs = loadOperationalCatalogs();
  const protection = evaluateEnvironmentProtection();
  const tunnel = createSecureTunnelAdapter().describe();

  return {
    version: 1,
    kind: 'operational-seed',
    seededAt: now(),
    notice:
      'Operational seed uses firm/ERO env + topology catalogs only. No demo taxpayer PII. Live IRS/SBTPG remain gated.',
    identity: PLATFORM_IDENTITY,
    firm,
    wiring: {
      summary: wiring.summary,
      services: wiring.services,
      workers: wiring.workers,
      pipelines: wiring.pipelines,
      approvedExternal: wiring.approvedExternal,
      edges: wiring.edges
    },
    catalogs,
    unfundedRefundInquiries: UNFUNDED_REFUND_INQUIRIES.map((i) => ({ ...i })),
    posture: {
      environmentProtection: protection,
      tunnel,
      transmissionAllowed: protection.transmissionAllowed === true,
      liveIrsReady: protection.transmissionAllowed === true && tunnel.status === 'ready'
    }
  };
}

/** Persist seed manifest under logs/operational/ (gitignored). */
export async function writeOperationalSeedManifest({
  cwd = process.cwd(),
  env = process.env,
  now = () => new Date().toISOString()
} = {}) {
  const seed = buildOperationalSeed({ env, now });
  const filePath = resolveSeedManifestPath(cwd);
  await writeJsonFile(filePath, seed);
  return { filePath, seed };
}

/** Load previously written seed manifest, or build a fresh one. */
export async function loadOperationalSeedManifest({ cwd = process.cwd(), env = process.env } = {}) {
  const filePath = resolveSeedManifestPath(cwd);
  const existing = await readJsonFile(filePath, null);
  if (existing?.kind === 'operational-seed') {
    return { filePath, seed: existing, source: 'disk' };
  }
  const seed = buildOperationalSeed({ env });
  return { filePath, seed, source: 'built' };
}

/**
 * Convenience: build seed + optionally apply into stores + persist manifest.
 */
export async function seedAndWireApplication({
  cwd = process.cwd(),
  env = process.env,
  crm = null,
  refunds = null,
  persist = true,
  apply = true,
  seedRefunds = true
} = {}) {
  const { filePath, seed } =
    persist
      ? await writeOperationalSeedManifest({ cwd, env })
      : { filePath: resolveSeedManifestPath(cwd), seed: buildOperationalSeed({ env }) };

  const applied = apply
    ? await applyOperationalSeed({
        crm,
        refunds,
        env,
        firm: seed.firm,
        inquiries: seed.unfundedRefundInquiries,
        seedRefunds
      })
    : null;

  return {
    filePath,
    seed,
    applied,
    wiringReady: seed.wiring.services.every((s) => Boolean(s.baseUrl)),
    firmComplete: Object.values(seed.firm.completeness).every(Boolean)
  };
}
