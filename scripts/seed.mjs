#!/usr/bin/env node
/**
 * Fully seed and wire the RTPSC application from operator env + topology.
 * Usage: ./rtpsc seed [--json] [--no-persist]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapEnv } from '../packages/platform-core/src/index.mjs';
import { createCrmStore } from '../packages/crm-core/src/index.mjs';
import { createRefundStore } from '../packages/refund-core/src/index.mjs';
import { seedAndWireApplication, writeJsonFile, resolveOperationalDataDir } from '../packages/operational-seed/src/index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main(argv = process.argv.slice(2)) {
  bootstrapEnv({ cwd: repoRoot });
  const asJson = argv.includes('--json');
  const persist = !argv.includes('--no-persist');

  const crm = createCrmStore();
  const refunds = createRefundStore();

  const result = await seedAndWireApplication({
    cwd: repoRoot,
    crm,
    refunds,
    persist,
    apply: true,
    seedRefunds: true
  });

  // Durable CRM / refund snapshots for service boot (gitignored).
  if (persist) {
    const dataDir = resolveOperationalDataDir(repoRoot);
    await writeJsonFile(path.join(dataDir, 'crm-snapshot.json'), {
      kind: 'crm-snapshot',
      updatedAt: new Date().toISOString(),
      counts: crm.snapshot(),
      accounts: crm.listAccounts(),
      contacts: crm.searchContacts('', { limit: 2000 }),
      interactions: crm._interactions.slice(0, 5000)
    });
    await writeJsonFile(path.join(dataDir, 'refund-snapshot.json'), {
      kind: 'refund-snapshot',
      updatedAt: new Date().toISOString(),
      cases: refunds.listCases({ limit: 100 })
    });
  }

  const report = {
    ok: true,
    company: result.seed.identity.company,
    application: result.seed.identity.application,
    manifest: result.filePath,
    wiringReady: result.wiringReady,
    firmComplete: result.firmComplete,
    services: result.seed.wiring.services.length,
    catalogSkus: result.seed.catalogs.counts.serviceCatalog,
    bankProducts: result.seed.catalogs.counts.bankProducts,
    unfundedInquiries: result.seed.unfundedRefundInquiries.length,
    applied: result.applied,
    firm: {
      email: result.seed.firm.email,
      operator: result.seed.firm.operator?.name ?? null,
      state: result.seed.firm.state,
      ero: result.seed.firm.ero,
      completeness: result.seed.firm.completeness
    },
    posture: {
      tunnelStatus: result.seed.posture.tunnel.status,
      transmissionAllowed: result.seed.posture.transmissionAllowed,
      liveIrsReady: result.seed.posture.liveIrsReady
    },
    notice: result.seed.notice
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Operational seed written → ${report.manifest}`);
    console.log(`Firm: ${report.company} · operator: ${report.firm.operator ?? '(set OPERATOR_NAME)'} · wiring: ${report.wiringReady ? 'ready' : 'incomplete'}`);
    console.log(`Catalog: ${report.catalogSkus} SKUs · ${report.bankProducts} bank products · ${report.unfundedInquiries} unfunded inquiries`);
    console.log(`Applied: firmAccount=${report.applied?.firmAccountId ?? 'n/a'} · operator=${report.applied?.operatorContactId ?? 'n/a'} · refunds=${report.applied?.refundCasesSeeded?.length ?? 0}`);
    console.log(`Tunnel: ${report.posture.tunnelStatus} · transmissionAllowed=${report.posture.transmissionAllowed}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main };
