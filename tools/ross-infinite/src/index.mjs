export { sha256, sha256File, digestUri } from './lib/hash.mjs';
export { parseSemver, compareSemver, satisfies, maxSatisfying } from './lib/semver.mjs';
export { canonicalize, stableStringify } from './lib/canonical.mjs';
export { resolveDependencies } from './lib/resolver.mjs';
export { writeLockfile, readLockfile, buildLockfileFromManifest } from './lib/lockfile.mjs';
export { transferFile, planChunkRanges, assertCoverage } from './lib/transfer.mjs';
export { putBytes, putJson, storeRoot } from './lib/store.mjs';
export { loadTaskfile, buildGraph, planTasks, runTasks, criticalPath } from './task/engine.mjs';
export { policyCheck } from './policy/check.mjs';
export { doctor } from './policy/doctor.mjs';
export { createRegistry } from './server/registry.mjs';
export { createMcpServer, TOOLS as MCP_TOOLS } from './server/mcp-lite.mjs';
export {
  loadOwnershipConfig,
  ownershipPlan,
  validateOwnershipConfig,
  DEFAULT_CONFIG as SEO_DEFAULT_CONFIG
} from './seo/ownership.mjs';
export { generateSeoAssets } from './seo/generate.mjs';
export { prevalidateOwnership } from './seo/prevalidate.mjs';
export { googleSearchConsole } from './seo/google.mjs';
export { indexNowSubmit } from './seo/indexnow.mjs';
export { EVIDENCE_STATES } from './seo/states.mjs';
export { runCli } from './cli.mjs';

export function describeApiSurface() {
  return {
    package: '@rtp/ross-infinite',
    version: '1.0.0',
    product: 'ROSS.CO Infinite',
    commands: [
      'init',
      'hash',
      'transfer',
      'resolve',
      'plan',
      'run',
      'analyze',
      'policy-check',
      'doctor',
      'registry',
      'seo'
    ]
  };
}
