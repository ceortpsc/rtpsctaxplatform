import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const modules = [
  '../packages/platform-core/src/index.mjs',
  '../packages/rtp-datastore/src/index.mjs',
  '../packages/sri-efin/src/index.mjs',
  '../packages/client-config/src/index.mjs',
  '../packages/client-identity/src/index.mjs',
  '../packages/security-core/src/index.mjs',
  '../packages/secrets-config/src/index.mjs',
  '../packages/refund-core/src/index.mjs',
  '../packages/secure-tunnel/src/index.mjs',
  '../packages/agent-build-team/src/index.mjs',
  '../packages/workflow-engine/src/index.mjs',
  '../packages/module-advisor/src/index.mjs',
  '../packages/bank-products/src/index.mjs',
  '../packages/bank-products/src/auth.mjs',
  '../packages/tax-data/src/index.mjs',
  '../packages/invoice-core/src/index.mjs',
  '../packages/invoice-core/src/pdf.mjs',
  '../packages/crm-core/src/index.mjs',
  '../packages/pos-core/src/index.mjs',
  '../packages/ero-ops/src/index.mjs',
  '../packages/agent-core/src/index.mjs',
  '../packages/agent-core/src/roster.mjs',
  '../packages/agent-core/src/assignments.mjs',
  '../packages/agent-core/src/dispatch.mjs',
  '../packages/agent-core/src/assignment-workflows.mjs',
  '../packages/canvas-core/src/index.mjs',
  '../agents/planning-agent/src/index.mjs',
  '../agents/scoping-agent/src/index.mjs',
  '../agents/testing-agent/src/index.mjs',
  '../agents/mapping-agent/src/index.mjs',
  '../agents/staging-agent/src/index.mjs',
  '../agents/assessment-agent/src/index.mjs',
  '../agents/markdown-agent/src/index.mjs',
  '../packages/production-compliance/src/index.mjs',
  '../packages/ai-assist/src/index.mjs',
  '../packages/ero-governance/src/index.mjs',
  '../services/api-gateway/src/index.mjs',
  '../services/irs-gateway/src/index.mjs',
  '../services/ai-workforce-hub/src/index.mjs',
  '../services/refund-status-service/src/index.mjs',
  '../services/transcript-service/src/index.mjs',
  '../services/analytics-service/src/index.mjs',
  '../services/enrollment-service/src/index.mjs',
  '../packages/ui-design-system/src/index.mjs',
  '../services/staff-portal/src/index.mjs',
  '../services/invoice-service/src/index.mjs',
  '../services/pos-crm-service/src/index.mjs',
  '../services/security-status-service/src/index.mjs',
  '../services/modules-dashboard/src/index.mjs',
  '../services/modules-dashboard/src/catalog.mjs',
  '../services/web-portal/src/index.mjs',
  '../services/web-portal/src/router.mjs',
  '../services/web-portal/src/layout.mjs',
  '../services/web-portal/src/accounts.mjs',
  '../services/web-portal/src/content.mjs',
  '../services/web-portal/src/status.mjs',
  '../services/web-portal/src/xml.mjs',
  '../workflows/refund-status-workflow/src/index.mjs',
  '../workflows/transcript-intake-workflow/src/index.mjs',
  '../workflows/transmission-workflow/src/index.mjs',
  '../workflows/agent-assignment-workflow/src/index.mjs',
  '../workflows/production-activation-workflow/src/index.mjs',
  '../packages/production-activation/src/index.mjs',
  '../workers/tds-worker/src/index.mjs',
  '../workers/transcript-pull-worker/src/index.mjs',
  '../workers/live-source-fetcher/src/index.mjs',
  '../workers/workflow-runner/src/index.mjs',
  '../workers/workflow-runner/src/registry.mjs',
  '../workers/ai-persona-worker/src/index.mjs',
  '../workers/security-scanner-worker/src/index.mjs',
  '../pipelines/transmission-pipeline/src/index.mjs',
  '../pipelines/masterfile-pipeline/src/index.mjs',
  '../pipelines/refund-status-pipeline/src/index.mjs',
  '../engines/refund-intelligence-engine/src/index.mjs',
  '../engines/refund-optimization-engine/src/index.mjs',
  '../engines/ai-persona-runtime/src/index.mjs',
  '../engines/analytics-center/src/index.mjs',
  '../engines/tc-code-engine/src/index.mjs',
  '../engines/pdf-fill-engine/src/index.mjs',
  '../packages/platform-core/src/registry.mjs',
  '../packages/platform-core/src/release-channels.mjs',
  '../tools/aol/src/index.mjs',
  '../tools/rossco/src/index.mjs'
];

export async function buildPlatform({ cwd = process.cwd(), quiet = false } = {}) {
  const manifest = [];
  for (const modulePath of modules) {
    const imported = await import(new URL(modulePath, import.meta.url));
    manifest.push({ modulePath, exports: Object.keys(imported) });
  }

  await mkdir(path.join(cwd, 'build'), { recursive: true });
  const outPath = path.join(cwd, 'build/platform-manifest.json');
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (!quiet) console.log('Build scaffold verification passed.');
  return { manifest, outPath };
}

const isMain =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

// Only auto-run when executed as a CLI entrypoint. Importers (e.g. release.mjs)
// call buildPlatform({ quiet: true }) so their stdout can stay pure JSON for CI.
if (isMain) {
  await buildPlatform({ quiet: false });
}
