import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSyncEngine,
  createTableStore,
  parseCsv,
  resolveTableName,
  listTableSchemas,
  describeDataSync,
  DATA_SYNC_POLICY
} from '../packages/data-sync/src/index.mjs';
import { createCrmStore } from '../packages/crm-core/src/index.mjs';
import { createRefundStore } from '../packages/refund-core/src/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'data', 'sync', 'fixtures');

test('data-sync describes tables and policy', () => {
  const desc = describeDataSync();
  assert.equal(desc.name, '@rtp/data-sync');
  assert.ok(desc.tables.includes('clients'));
  assert.ok(DATA_SYNC_POLICY.length >= 3);
  assert.equal(listTableSchemas().length, 6);
});

test('parseCsv normalizes headers and rows', () => {
  const csv = 'Taxpayer Ref,Name,Email\nTP-1,Ada Lovelace,ada@example.com\n';
  const parsed = parseCsv(csv);
  assert.deepEqual(parsed.headers, ['taxpayerRef', 'name', 'email']);
  assert.equal(parsed.rows[0].taxpayerRef, 'TP-1');
  assert.equal(resolveTableName('clients.csv'), 'clients');
  assert.equal(resolveTableName('refunds.json'), 'refund_cases');
});

test('table store upserts by primary key', () => {
  const store = createTableStore();
  const a = store.upsert('clients', { taxpayerRef: 'TP-1', name: 'Ada' });
  const b = store.upsert('clients', { taxpayerRef: 'TP-1', name: 'Ada King', email: 'ada@example.com' });
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(store.count('clients'), 1);
  assert.equal(store.get('clients', 'TP-1').name, 'Ada King');
});

test('import fixture CSVs and project into CRM + refunds', async () => {
  const engine = createSyncEngine();
  const clients = await engine.importFile(path.join(fixtures, 'clients.sample.csv'), { table: 'clients' });
  const cases = await engine.importFile(path.join(fixtures, 'refund_cases.sample.csv'), { table: 'refund_cases' });
  const ledger = await engine.importFile(path.join(fixtures, 'federal_ledger.sample.csv'), {
    table: 'federal_ledger'
  });
  const interactions = await engine.importFile(path.join(fixtures, 'interactions.sample.csv'), {
    table: 'interactions'
  });

  assert.equal(clients.inserted, 3);
  assert.equal(cases.inserted, 3);
  assert.equal(ledger.inserted, 2);
  assert.equal(interactions.inserted, 2);

  const crm = createCrmStore();
  const refunds = createRefundStore();
  const projection = await engine.project({ crmStore: crm, refundStore: refunds, includeTaxSeed: true });

  assert.ok(projection.projections.tax_rates.summary.inserted + projection.projections.tax_rates.summary.updated > 10);
  assert.equal(projection.projections.crm.summary.created, 3);
  assert.ok(projection.projections.crm.summary.interactionsLinked >= 2);
  assert.ok(crm.searchContacts('Jordan').length >= 1);
  assert.ok(crm.searchContacts('TP-88').length >= 1);
  assert.ok(projection.projections.refunds.summary.ingested >= 3);
  assert.ok(refunds.listCases({ taxpayerRef: 'TP-77' }).length >= 1);
});

test('syncDirectory loads data/sync demo CSVs', async () => {
  const engine = createSyncEngine();
  const result = await engine.syncDirectory(path.join(root, 'data', 'sync'));
  assert.ok(result.imported.length >= 4);
  assert.ok(result.counts.clients >= 3);
  assert.ok(result.counts.refund_cases >= 3);
});
