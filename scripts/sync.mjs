#!/usr/bin/env node
// RTPSC data & table synchronization CLI — ./rtpsc sync …
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSyncEngine, resolveTableName, describeDataSync } from '../packages/data-sync/src/index.mjs';
import { createCrmStore } from '../packages/crm-core/src/index.mjs';
import { createRefundStore } from '../packages/refund-core/src/index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const syncDir = process.env.DATA_SYNC_DIR ?? path.join(repoRoot, 'data', 'sync');
const persistPath = process.env.DATA_SYNC_STORE ?? path.join(syncDir, 'store.json');

function usage() {
  return [
    'RTPSC data & table synchronization',
    '',
    'Usage:',
    '  ./rtpsc sync status',
    '  ./rtpsc sync tables',
    '  ./rtpsc sync run [--no-project] [--no-persist]',
    '  ./rtpsc sync import <table> <file.csv|file.json>',
    '  ./rtpsc sync project',
    '',
    'Tables: clients | refund_cases | invoices | tax_rates | interactions | federal_ledger',
    `Directory: ${syncDir}`,
    ''
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const [cmd = 'status', ...rest] = argv;
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(usage());
    return 0;
  }

  const engine = createSyncEngine({ persistPath });
  await engine.store.loadPersisted();

  if (cmd === 'status') {
    console.log(JSON.stringify({ ...describeDataSync(), ...engine.status() }, null, 2));
    return 0;
  }

  if (cmd === 'tables') {
    console.log(JSON.stringify({ tables: engine.listTableSchemas() }, null, 2));
    return 0;
  }

  if (cmd === 'import') {
    const [tableArg, fileArg] = rest;
    if (!tableArg || !fileArg) {
      console.error(usage());
      return 1;
    }
    const table = resolveTableName(tableArg) ?? tableArg;
    const filePath = path.resolve(repoRoot, fileArg);
    await access(filePath);
    const result = await engine.importFile(filePath, { table, source: `cli:${path.basename(filePath)}` });
    await engine.store.persist();
    console.log(JSON.stringify(result, null, 2));
    return result.errors?.length ? 1 : 0;
  }

  if (cmd === 'project') {
    const crmStore = createCrmStore();
    const refundStore = createRefundStore();
    const result = await engine.project({ crmStore, refundStore, includeTaxSeed: true });
    await engine.store.persist();
    console.log(
      JSON.stringify(
        {
          projections: Object.fromEntries(
            Object.entries(result.projections).map(([k, v]) => [k, v.summary ?? v])
          ),
          crm: crmStore.snapshot(),
          refunds: refundStore.listCases({ limit: 20 }).length,
          run: result.run
        },
        null,
        2
      )
    );
    return 0;
  }

  if (cmd === 'run') {
    const noProject = rest.includes('--no-project');
    const noPersist = rest.includes('--no-persist');
    const crmStore = noProject ? null : createCrmStore();
    const refundStore = noProject ? null : createRefundStore();
    const result = await engine.runFullSync({
      directory: syncDir,
      crmStore,
      refundStore,
      persist: !noPersist,
      includeTaxSeed: true
    });
    console.log(
      JSON.stringify(
        {
          directory: syncDir,
          imported: result.directory.imported?.map((f) => ({
            file: f.file,
            table: f.table,
            inserted: f.inserted,
            updated: f.updated,
            errors: f.errors?.length ?? 0
          })),
          skipped: result.directory.skipped,
          projections: Object.fromEntries(
            Object.entries(result.projection.projections).map(([k, v]) => [k, v.summary ?? v])
          ),
          persist: result.persist,
          counts: result.counts,
          tables: result.tables
        },
        null,
        2
      )
    );
    return 0;
  }

  console.error(`Unknown sync subcommand: ${cmd}\n`);
  console.error(usage());
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code ?? 0));
}

export { main as runSyncCli, usage as syncUsage };
