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
  'docs/ross-ai-runtime-platform.md',
  'ross.py',
  'ross_ai/__init__.py',
  'ross_ai/cli.py',
  'ross_ai/auth.py',
  'ross_ai/membership.py',
  'ross_ai/billing.py',
  'ross_ai/legal.py',
  'ross_ai/otp.py',
  'ross_ai/mailer.py',
  'ross_ai/rbac.py',
  'ross_ai/github_oauth.py',
  'ross_ai/execution.py',
  'ross_ai/brand.py',
  'ross_ai/seo.py',
  'ross_ai/platform_server.py',
  'ross_ai/web/static/favicon.svg',
  'ross_ai/web/static/og-default.svg',
  'ross_ai/web/static/app.css',
  'ross_ai/web/static/app.js',
  'docker-compose.ross.yml',
  'Dockerfile.ross',
  'requirements.txt',
  '.env.example',
  'docs/cursor-environment.md',
  'tools/aol/bin/aol.mjs',
  'tools/aol/package.json',
  'tools/aol/NOTICE',
  'aol.config.json',
  'RTPSC-package-lock.json',
  'tools/aol/RTPSC-package-lock.schema.json',
  'docs/rtpsc-package-lock.md',
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
  'services/api-gateway/package.json',
  'services/irs-gateway/package.json',
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
