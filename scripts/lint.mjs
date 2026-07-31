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
  'docs/enterprise-tax-software-checklist.md',
  'docs/production-compliance-report.md',
  'docs/irm-aligned-handbook.md',
  'packages/ai-assist/package.json',
  'packages/ai-assist/src/index.mjs',
  'docs/aol-package-manager.md',
  'docs/aol-intellectual-property.md',
  'docs/aol-api-and-config.md',
  'docs/agent-build-engineering-team.md',
  'packages/agent-build-team/package.json',
  'packages/agent-build-team/bin/abet.mjs',
  'packages/agent-build-team/src/index.mjs',
  'docs/cursor-environment.md',
  'docs/rossco-itr-package-manager.md',
  'docs/rossco-intellectual-property.md',
  'docs/refund-optimization-intelligence.md',
  'docs/release-channels.md',
  'docs/ai-persona-workforce.md',
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
  'RTPSC-footprints.json',
  'tools/aol/RTPSC-package-lock.schema.json',
  'docs/rtpsc-package-lock.md',
  'engines/refund-optimization-engine/package.json',
  'engines/refund-optimization-engine/src/index.mjs',
  'packages/production-compliance/package.json',
  'packages/production-compliance/bin/prodcheck.mjs',
  'packages/production-compliance/src/index.mjs',
  'policy/procedures/production-signoffs/registry.json',
  'policy/procedures/production-signoffs/README.md',
  'infra/terraform/modules/platform-service/main.tf',
  '.github/workflows/ci.yml',
  '.github/workflows/compliance.yml',
  '.github/workflows/rtpsc-deploy.yml',
  '.cursor/environment.json',
  '.cursor/Dockerfile',
  'Dockerfile',
  'docs/cursor-canvas.md',
  'docs/cursor-environment.md',
  'packages/canvas-core/package.json',
  'packages/canvas-core/src/index.mjs',
  '.cursor/skills/rtpsc-canvas/SKILL.md',
  'docs/CURSOR_TERMINAL_AGENT.md',
  'scripts/cloud-doctor.mjs'
];

const packageFiles = [
  'package.json',
  'packages/platform-core/package.json',
  'packages/client-config/package.json',
  'packages/client-identity/package.json',
  'packages/refund-core/package.json',
  'packages/secure-tunnel/package.json',
  'packages/agent-build-team/package.json',
  'packages/workflow-engine/package.json',
  'packages/module-advisor/package.json',
  'packages/agent-core/package.json',
  'packages/canvas-core/package.json',
  'packages/bank-products/package.json',
  'packages/tax-data/package.json',
  'packages/invoice-core/package.json',
  'packages/crm-core/package.json',
  'packages/pos-core/package.json',
  'packages/ero-ops/package.json',
  'packages/production-compliance/package.json',
  'packages/ai-assist/package.json',
  'packages/ero-governance/package.json',
  'services/enrollment-service/package.json',
  'services/invoice-service/package.json',
  'services/pos-crm-service/package.json',
  'services/api-gateway/package.json',
  'services/irs-gateway/package.json',
  'services/ai-workforce-hub/package.json',
  'services/refund-status-service/package.json',
  'services/transcript-service/package.json',
  'services/analytics-service/package.json',
  'services/modules-dashboard/package.json',
  'workers/tds-worker/package.json',
  'workers/transcript-pull-worker/package.json',
  'workers/live-source-fetcher/package.json',
  'workers/workflow-runner/package.json',
  'workers/ai-persona-worker/package.json',
  'workflows/refund-status-workflow/package.json',
  'workflows/transcript-intake-workflow/package.json',
  'workflows/transmission-workflow/package.json',
  'workflows/agent-assignment-workflow/package.json',
  'engines/refund-optimization-engine/package.json',
  'engines/refund-intelligence-engine/package.json',
  'engines/ai-persona-runtime/package.json',
  'agents/planning-agent/package.json',
  'agents/scoping-agent/package.json',
  'agents/testing-agent/package.json',
  'agents/mapping-agent/package.json',
  'agents/staging-agent/package.json',
  'agents/assessment-agent/package.json',
  'agents/markdown-agent/package.json',
  'tools/rossco/package.json',
  'tools/aol/package.json'
];

/** Critical JSON configs that must parse (catches merge-corruption early). */
const criticalJsonFiles = [
  'package.json',
  'aol.config.json',
  'rossco.config.json',
  'RTPSC-package-lock.json',
  'RTPSC-footprints.json',
  '.cursor/environment.json',
  'pnpm-workspace.yaml'
];

function assertSinglePackageManager(raw) {
  const matches = raw.match(/"packageManager"\s*:/g) || [];
  if (matches.length !== 1) {
    throw new Error(
      `package.json must declare exactly one "packageManager" field (found ${matches.length}). ` +
        'Duplicate keys break pnpm/action-setup (last-wins can become aol@…).'
    );
  }
}

function assertPnpmPackageManager(pkg) {
  const value = pkg.packageManager;
  if (typeof value !== 'string' || !/^pnpm@\d+\.\d+\.\d+/.test(value)) {
    throw new Error(
      `package.json "packageManager" must be a pnpm semver pin like "pnpm@10.33.3" (got ${JSON.stringify(value)}).`
    );
  }
}

function assertLockfileShape(lock) {
  if (!lock || typeof lock !== 'object') throw new Error('RTPSC-package-lock.json is empty.');
  if (![1, 2].includes(lock.lockfileVersion)) {
    throw new Error(`RTPSC-package-lock.json unsupported lockfileVersion: ${lock.lockfileVersion}`);
  }
  if (!lock.packages || typeof lock.packages !== 'object') {
    throw new Error('RTPSC-package-lock.json missing packages map.');
  }
  if (!lock.stats || typeof lock.stats.workspaceCount !== 'number') {
    throw new Error('RTPSC-package-lock.json missing stats.workspaceCount.');
  }
}

function assertEnvironmentShape(env) {
  if (typeof env.install !== 'string' || !env.install.includes('aol')) {
    throw new Error('.cursor/environment.json "install" must invoke AOL.');
  }
  // Cursor resolves build.dockerfile relative to .cursor/ — "Dockerfile" → .cursor/Dockerfile.
  if (env.build?.dockerfile !== 'Dockerfile') {
    throw new Error(
      '.cursor/environment.json build.dockerfile must be "Dockerfile" (path is relative to .cursor/). ' +
        `Got ${JSON.stringify(env.build?.dockerfile)}.`
    );
  }
  if (!Array.isArray(env.ports) || env.ports.length === 0) {
    throw new Error('.cursor/environment.json must declare ports.');
  }
  const names = env.ports.map((p) => p.name);
  if (new Set(names).size !== names.length) {
    throw new Error('.cursor/environment.json has duplicate port names.');
  }
}

for (const relativePath of requiredPaths) {
  await access(path.join(root, relativePath));
}

for (const relativePath of packageFiles) {
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

// Strict JSON validity for quality-gate critical files (YAML workspace is text-checked).
for (const relativePath of criticalJsonFiles) {
  const full = path.join(root, relativePath);
  const raw = await readFile(full, 'utf8');
  if (relativePath.endsWith('.yaml') || relativePath.endsWith('.yml')) {
    if (!raw.includes('packages:')) {
      throw new Error(`${relativePath} does not look like a pnpm workspace file.`);
    }
    continue;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (relativePath === 'package.json') {
    assertSinglePackageManager(raw);
    assertPnpmPackageManager(parsed);
  }
  if (relativePath === 'RTPSC-package-lock.json') {
    assertLockfileShape(parsed);
  }
  if (relativePath === '.cursor/environment.json') {
    assertEnvironmentShape(parsed);
  }
}

console.log('Scaffold lint checks passed.');
