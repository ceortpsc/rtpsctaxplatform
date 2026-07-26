import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefundStore } from '../packages/refund-core/src/index.mjs';

test('full refund ingest runs pipeline, workflow, and intelligence', async () => {
  const store = createRefundStore();
  const result = await store.ingestEvent({
    caseId: 'CASE-42',
    taxpayerRef: 'TP-77',
    filingStage: 'approved',
    amount: 2500,
    hasTranscript: true,
    source: 'test'
  });
  assert.equal(result.case.id, 'CASE-42');
  assert.equal(result.case.status, 'refund-approved');
  assert.equal(typeof result.case.riskScore, 'number');
  assert.ok(result.case.intelligence);
  assert.ok(result.pipeline.stages.length >= 4);
  assert.equal(result.workflowRun.status, 'succeeded');
  assert.ok(result.case.timeline.length >= 3);

  const again = await store.ingestEvent({ caseId: 'CASE-42', filingStage: 'sent', taxpayerRef: 'TP-77' });
  assert.equal(again.case.status, 'refund-sent');
  assert.ok(store.listCases().length >= 1);
});

test('full refund path across stages builds a rich timeline', async () => {
  const store = createRefundStore();
  for (const filingStage of ['received', 'processing', 'approved', 'sent']) {
    await store.ingestEvent({ caseId: 'CASE-FULL', taxpayerRef: 'TP-1', filingStage, amount: 3200 });
  }
  const record = store.getCase('CASE-FULL');
  assert.equal(record.status, 'refund-sent');
  assert.ok(record.timeline.length >= 8);
});
