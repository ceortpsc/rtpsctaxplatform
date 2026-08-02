import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createWorkerDescriptor,
  loadRuntimeConfig,
  redactConfig
} from '../../../packages/platform-core/src/index.mjs';
import { createSyncEngine } from '../../../packages/data-sync/src/index.mjs';
import { createCrmStore } from '../../../packages/crm-core/src/index.mjs';
import { createRefundStore } from '../../../packages/refund-core/src/index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const syncDir = process.env.DATA_SYNC_DIR ?? path.join(repoRoot, 'data', 'sync');
const persistPath = process.env.DATA_SYNC_STORE ?? path.join(syncDir, 'store.json');

export const dataSyncWorkerDescriptor = createWorkerDescriptor({
  name: 'data-sync-worker',
  responsibilities: [
    'Import approved CSV/JSON table files from data/sync.',
    'Upsert shared platform tables (clients, refunds, invoices, tax rates, ledger).',
    'Project synchronized rows into CRM and refund-core stores.',
    'Persist a local sync snapshot (gitignored) for operator continuity.'
  ]
});

export async function runDataSyncJob({
  directory = syncDir,
  persist = true,
  projectTargets = true
} = {}) {
  const config = loadRuntimeConfig();
  const engine = createSyncEngine({ persistPath });
  const load = await engine.store.loadPersisted();

  const crmStore = projectTargets ? createCrmStore() : null;
  const refundStore = projectTargets ? createRefundStore() : null;

  const result = await engine.runFullSync({
    directory,
    crmStore,
    refundStore,
    persist,
    includeTaxSeed: true
  });

  return {
    worker: dataSyncWorkerDescriptor.name,
    runtime: redactConfig(config),
    directory,
    persistPath,
    load,
    steps: [
      { name: 'load-persist', ok: true, detail: load.loaded ? 'loaded' : load.reason },
      {
        name: 'import-directory',
        ok: true,
        detail: `${result.directory.imported?.length ?? 0} file(s)`,
        files: result.directory.imported?.map((f) => f.file) ?? []
      },
      { name: 'seed-tax-rates', ok: true, detail: result.projection.projections.tax_rates?.summary },
      {
        name: 'project-crm-refunds',
        ok: true,
        detail: {
          crm: result.projection.projections.crm?.summary ?? null,
          refunds: result.projection.projections.refunds?.summary ?? null
        }
      },
      { name: 'persist-snapshot', ok: Boolean(result.persist?.persisted), detail: result.persist }
    ],
    counts: result.counts,
    tables: result.tables,
    policy: engine.status().policy
  };
}

export function start() {
  const once = process.argv.includes('--once');
  return Promise.resolve(runDataSyncJob()).then((output) => {
    console.log(JSON.stringify(output, null, 2));
    if (!once) {
      console.log(
        `${dataSyncWorkerDescriptor.name} completed one sync cycle. Use --once for CI; re-run to refresh tables.`
      );
    }
    return output;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await start();
}
