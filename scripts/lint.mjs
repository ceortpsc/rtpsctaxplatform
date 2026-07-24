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
  'docs/irm-aligned-handbook.md',
  'docs/aol-package-manager.md',
  'tools/aol/bin/aol.mjs',
  'tools/aol/package.json',
  'infra/terraform/modules/platform-service/main.tf',
  '.github/workflows/ci.yml',
  '.github/workflows/compliance.yml'
];

for (const relativePath of requiredPaths) {
  await access(path.join(root, relativePath));
}

const packageFiles = [
  'package.json',
  'packages/platform-core/package.json',
  'packages/client-config/package.json',
  'packages/secure-tunnel/package.json',
  'services/api-gateway/package.json',
  'services/refund-status-service/package.json',
  'services/transcript-service/package.json',
  'services/analytics-service/package.json',
  'workers/tds-worker/package.json',
  'workers/transcript-pull-worker/package.json',
  'workers/live-source-fetcher/package.json'
];

for (const relativePath of packageFiles) {
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

console.log('Scaffold lint checks passed.');
