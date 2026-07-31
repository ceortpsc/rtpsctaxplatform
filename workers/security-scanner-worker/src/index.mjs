// One-shot security scanner worker — writes build/security-posture-report.json.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkerDescriptor, runWorker, PLATFORM_IDENTITY } from '../../../packages/platform-core/src/index.mjs';
import {
  createSecurityAuditLog,
  evaluateSecurityPosture,
  createSecurityCoreDescriptor
} from '../../../packages/security-core/src/index.mjs';
import { evaluateSecretsStatus, listSecretCatalog } from '../../../packages/secrets-config/src/index.mjs';
import { createSecureTunnelAdapter, evaluateTunnelGate } from '../../../packages/secure-tunnel/src/index.mjs';
import { evaluateEnvironmentProtection, loadRuntimeConfig } from '../../../packages/platform-core/src/index.mjs';

export const securityScannerDescriptor = createWorkerDescriptor({
  name: 'security-scanner-worker',
  responsibilities: [
    'Evaluate secrets readiness, tunnel gate, encryption/session posture.',
    'Write a redacted security posture report under build/.',
    'Append a security audit event for the scan cycle.'
  ],
  schedule: 'on-demand',
  mode: 'one-shot'
});

export async function runSecurityScan({ env = process.env, root = process.cwd() } = {}) {
  const config = loadRuntimeConfig();
  const secrets = evaluateSecretsStatus({ env });
  const tunnelGate = evaluateTunnelGate({ env });
  const tunnel = createSecureTunnelAdapter({ env });
  const posture = evaluateSecurityPosture({ env, tunnelGate, secretsStatus: secrets });
  const environmentProtection = evaluateEnvironmentProtection(config);
  const audit = createSecurityAuditLog({ persist: true });

  const report = {
    identity: PLATFORM_IDENTITY,
    worker: securityScannerDescriptor,
    core: createSecurityCoreDescriptor(),
    posture,
    secrets: {
      summary: secrets.summary,
      ready: secrets.ready,
      configuredGroups: secrets.configuredGroups,
      missingRequired: secrets.missingRequired,
      catalog: listSecretCatalog()
    },
    tunnel,
    environmentProtection,
    generatedAt: new Date().toISOString()
  };

  const outDir = path.join(root, 'build');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'security-posture-report.json');
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await audit.record({
    action: 'security.scan',
    outcome: posture.readyForHardenedAuth && secrets.ready ? 'pass' : 'attention',
    detail: { reportPath: 'build/security-posture-report.json', reasons: posture.reasons }
  });

  return { report, outPath };
}

export function start() {
  const steps = [
    { id: 'evaluate-secrets', status: 'planned' },
    { id: 'evaluate-tunnel-gate', status: 'planned' },
    { id: 'evaluate-security-posture', status: 'planned' },
    { id: 'write-security-posture-report', status: 'planned' },
    { id: 'append-security-audit', status: 'planned' }
  ];

  if (process.argv.includes('--once') || process.argv.includes('--scan')) {
    return runSecurityScan().then(({ report, outPath }) => {
      console.log(JSON.stringify({ ...report, writtenTo: outPath }, null, 2));
      return report;
    });
  }

  return runWorker({ descriptor: securityScannerDescriptor, steps });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  Promise.resolve(start()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
