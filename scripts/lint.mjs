import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const requiredPaths = [
  'README.md',
  'docs/architecture.md',
  'docs/engineering-standards.md',
  'docs/api-spec-overview.md',
  'docs/operations-runbook.md',
  'docs/compliance-and-governance.md',
  'docs/live-production-checklist.md',
  'docs/production-compliance-report.md',
  'docs/irm-aligned-handbook.md',
  'docs/aol-package-manager.md',
  'docs/aol-intellectual-property.md',
  'docs/aol-api-and-config.md',
  'docs/cursor-environment.md',
  'docs/rossco-itr-package-manager.md',
  'docs/rossco-intellectual-property.md',
  'docs/refund-optimization-intelligence.md',
  'docs/ai-persona-workforce.md',
  'tools/aol/bin/aol.mjs',
  'tools/aol/package.json',
  'tools/aol/NOTICE',
  'tools/rossco/bin/rossco.mjs',
  'tools/rossco/package.json',
  'tools/rossco/NOTICE',
  'tools/rossco/rossco.config.schema.json',
  'aol.config.json',
  'rossco.config.json',
  'RTPSC-package-lock.json',
  'tools/aol/RTPSC-package-lock.schema.json',
  'docs/rtpsc-package-lock.md',
  'engines/refund-optimization-engine/package.json',
  'engines/refund-optimization-engine/src/index.mjs',
  'packages/production-compliance/package.json',
  'packages/production-compliance/bin/prodcheck.mjs',
  'packages/production-compliance/src/index.mjs',
  'infra/terraform/modules/platform-service/main.tf',
  '.github/workflows/ci.yml',
  '.github/workflows/compliance.yml',
  '.github/workflows/rtpsc-deploy.yml',
  '.cursor/environment.json',
  '.cursor/Dockerfile',
  'Dockerfile',
  'requirements.txt',
  '.env.example'
];

for (const relativePath of requiredPaths) {
  await access(path.join(root, relativePath));
}

const packageFiles = [
  'package.json',
  'packages/platform-core/package.json',
  'packages/client-config/package.json',
  'packages/secure-tunnel/package.json',
  'packages/production-compliance/package.json',
  'packages/ero-governance/package.json',
  'tools/rossco/package.json',
  'engines/refund-optimization-engine/package.json',
  'engines/refund-intelligence-engine/package.json',
  'engines/ai-persona-runtime/package.json',
  'services/api-gateway/package.json',
  'services/irs-gateway/package.json',
  'services/ai-workforce-hub/package.json',
  'services/refund-status-service/package.json',
  'services/transcript-service/package.json',
  'services/analytics-service/package.json',
  'workers/tds-worker/package.json',
  'workers/transcript-pull-worker/package.json',
  'workers/live-source-fetcher/package.json',
  'workers/ai-persona-worker/package.json'
];

for (const relativePath of packageFiles) {
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

console.log('Scaffold lint checks passed.');
