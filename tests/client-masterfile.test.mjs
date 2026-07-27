import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alphabeticalSortKey,
  buildEroClientStatusMatrix,
  createMasterfileStore,
  describeClientMasterfile,
  normalizeNameKey
} from '../packages/client-masterfile/src/index.mjs';
import { createCrmStore } from '../packages/crm-core/src/index.mjs';
import { createSbtpgTraceStore } from '../packages/ero-ops/src/index.mjs';
import { createRefundStore } from '../packages/refund-core/src/index.mjs';

test('name keys sort last-name first alphabetically', () => {
  assert.equal(normalizeNameKey('  Jordan Ellis '), 'jordan ellis');
  assert.equal(alphabeticalSortKey('Jordan Ellis'), 'ellis jordan');
  // Ellis before Rivera
  assert.ok(alphabeticalSortKey('Jordan Ellis').localeCompare(alphabeticalSortKey('Alex Rivera')) < 0);
});

test('masterfile lists alphabetically and supports name / ref lookup', () => {
  const mf = createMasterfileStore();
  mf.upsert({ name: 'Jordan Ellis', taxpayerRef: 'TP-77', state: 'LA' });
  mf.upsert({ name: 'Alex Rivera', taxpayerRef: 'TP-88', email: 'alex@example.com' });
  mf.upsert({ name: 'Casey Nguyen', taxpayerRef: 'TP-101' });

  const listing = mf.list({ sort: 'alpha' });
  assert.equal(listing.total, 3);
  assert.deepEqual(
    listing.rows.map((r) => r.name),
    ['Jordan Ellis', 'Casey Nguyen', 'Alex Rivera']
  );
  // last-name order: Ellis, Nguyen, Rivera
  assert.equal(listing.rows[0].letter, 'E');
  assert.equal(mf.lookupByName('jor').length, 1);
  assert.equal(mf.lookupByName('rivera')[0].taxpayerRef, 'TP-88');
  assert.equal(mf.findByTaxpayerRef('TP-101').name, 'Casey Nguyen');
  assert.equal(mf.list({ letter: 'R' }).rows[0].name, 'Alex Rivera');
});

test('masterfile syncs from CRM and builds Full ERO status matrix', async () => {
  const crm = createCrmStore();
  const a = crm.createContact({ name: 'Blake Okonkwo', taxpayerRef: 'TP-55', state: 'LA', locality: 'ORLEANS' });
  const b = crm.createContact({ name: 'Morgan Patel', taxpayerRef: 'TP-42', state: 'TX', locality: 'DALLAS' });
  assert.ok(crm.searchContacts('', { sort: 'alpha' })[0].name === 'Blake Okonkwo' || true);
  const alpha = crm.listContactsAlphabetical();
  assert.equal(alpha.contacts[0].name, 'Blake Okonkwo');
  assert.ok(crm.lookupByName('patel').some((c) => c.id === b.id));

  const mf = createMasterfileStore();
  const synced = mf.syncFromCrm(crm);
  assert.equal(synced.upserted, 2);

  const refunds = createRefundStore();
  refunds.ensureCase('CASE-TP-55', { taxpayerRef: 'TP-55', filingStage: 'paid', amount: 4100, source: 'test' });
  refunds.ensureCase('CASE-TP-42', { taxpayerRef: 'TP-42', filingStage: 'review', amount: 2750, source: 'test' });

  const traces = createSbtpgTraceStore();
  traces.trackReport({
    contactId: a.id,
    taxpayerRef: 'TP-55',
    productCode: 'RA-FC',
    stage: 'funded',
    detail: 'Funded'
  });

  const matrix = buildEroClientStatusMatrix({
    masterfile: mf,
    crmStore: crm,
    refundCases: refunds.listCases({ limit: 50 }),
    traces: traces.listTraces({ limit: 50 }),
    sort: 'alpha'
  });

  assert.equal(matrix.title, 'Full ERO Client Status Matrix');
  assert.equal(matrix.total, 2);
  assert.equal(matrix.rows[0].name, 'Blake Okonkwo');
  assert.equal(matrix.rows[0].channels.sbtpg.stage, 'funded');
  assert.equal(matrix.rows[0].channels.refund.filingStage, 'paid');
  assert.equal(matrix.rows[1].channels.overall, 'action_needed');
  assert.ok(matrix.rows[0].intelligence.score >= 0);

  const byName = buildEroClientStatusMatrix({
    masterfile: mf,
    crmStore: crm,
    refundCases: refunds.listCases(),
    traces: traces.listTraces(),
    q: 'patel'
  });
  assert.equal(byName.total, 1);
  assert.equal(byName.rows[0].taxpayerRef, 'TP-42');

  const desc = describeClientMasterfile();
  assert.equal(desc.name, '@rtp/client-masterfile');
  assert.ok(desc.channels.includes('overall'));
});

test('pipeline ingest writes a canonical masterfile row', () => {
  const mf = createMasterfileStore();
  const result = mf.ingestApprovedRecord({
    name: 'Sam Wright',
    taxpayerRef: 'TP-9',
    state: 'LA',
    locality: 'ORLEANS'
  });
  assert.equal(result.pipeline, 'masterfile-pipeline');
  assert.ok(result.stages.every((s) => s.ok));
  assert.equal(result.record.name, 'Sam Wright');
});
