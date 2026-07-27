#!/usr/bin/env node
/**
 * Execute Tax Practitioner suite lifecycle (TC 570/810 → release → reconcile).
 * Usage: ./rtpsc practitioner [lifecycle|account|integrations] [--json]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapEnv, PLATFORM_IDENTITY } from '../packages/platform-core/src/index.mjs';
import { createPractitionerSuite } from '../packages/irs-practitioner/src/index.mjs';
import { writeJsonFile, resolveOperationalDataDir } from '../packages/operational-seed/src/index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main(argv = process.argv.slice(2)) {
  bootstrapEnv({ cwd: repoRoot });
  const asJson = argv.includes('--json');
  const cmd = argv.find((a) => !a.startsWith('--')) || 'lifecycle';
  const suite = createPractitionerSuite();
  await suite.ensureClients();

  let report;
  if (cmd === 'account') {
    report = { ok: true, command: cmd, account: suite.accountInterface() };
  } else if (cmd === 'integrations') {
    report = { ok: true, command: cmd, integrations: suite.integrations };
  } else if (cmd === 'lifecycle') {
    const result = suite.executeRefundReleaseLifecycle({
      caseId: process.env.PRACTITIONER_CASE_ID || 'UF-2026-001',
      taxpayerRef: process.env.PRACTITIONER_TAXPAYER_REF || 'TP-UF-001',
      amount: Number(process.env.PRACTITIONER_AMOUNT || 3200),
      rectifyCodes: ['570', '810'],
      operator: suite.firm.operator?.name || 'ero'
    });
    const outDir = resolveOperationalDataDir(repoRoot);
    await writeJsonFile(path.join(outDir, 'practitioner-release-lifecycle.json'), {
      company: PLATFORM_IDENTITY.company,
      ranAt: new Date().toISOString(),
      ...result,
      // Drop bulky xml from summary file pointer — still on release objects
      notice: 'Scaffold issuance only — live IRS 846 requires production gates.'
    });
    report = {
      ok: true,
      command: cmd,
      caseId: result.release.caseId,
      releaseId: result.release.id,
      status: result.release.status,
      issued: result.release.issued,
      tc846Posted: result.release.tc846Posted,
      liveIrsIssuance: result.release.liveIrsIssuance,
      reconciliation: result.reconciliation.status,
      balanced: result.reconciliation.balanced,
      clearedCodes: result.release.clearedCodes,
      artifact: path.join(outDir, 'practitioner-release-lifecycle.json')
    };
  } else {
    console.error(`Unknown practitioner command: ${cmd}`);
    process.exitCode = 1;
    return;
  }

  if (asJson) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Practitioner ${report.command}: ${report.ok ? 'ok' : 'fail'}`);
    if (report.releaseId) {
      console.log(
        `Release ${report.releaseId} · ${report.status} · issued=${report.issued} · reconcile=${report.reconciliation} · artifact=${report.artifact}`
      );
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main };
