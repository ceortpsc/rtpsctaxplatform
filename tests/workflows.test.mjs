import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowRunner, createWorkflowRegistry } from '../packages/workflow-engine/src/index.mjs';
import { refundStatusWorkflow } from '../workflows/refund-status-workflow/src/index.mjs';
import { transcriptIntakeWorkflow } from '../workflows/transcript-intake-workflow/src/index.mjs';
import { transmissionWorkflow } from '../workflows/transmission-workflow/src/index.mjs';
import { createPlatformRegistry, platformWorkflows } from '../workers/workflow-runner/src/registry.mjs';

function runnerFor(workflow) {
  const registry = createWorkflowRegistry([workflow]);
  return createWorkflowRunner({ registry });
}

test('refund-status workflow evaluates status and scores risk deterministically', async () => {
  const runner = runnerFor(refundStatusWorkflow);
  const record = await runner.run('refund-status-update', {
    caseId: 'CASE-10042',
    taxpayerRef: 'TP-88',
    filingStage: 'approved'
  });
  assert.equal(record.status, 'succeeded');
  assert.equal(record.output.refundStatus, 'refund-approved');
  assert.equal(typeof record.output.riskScore, 'number');
  assert.equal(record.output.emittedEvent.type, 'refund.status.updated');

  const repeat = await runner.run('refund-status-update', { caseId: 'CASE-10042', filingStage: 'approved' });
  assert.equal(repeat.output.riskScore, record.output.riskScore, 'risk score must be deterministic');
});

test('refund-status workflow fails when caseId is missing', async () => {
  const runner = runnerFor(refundStatusWorkflow);
  const record = await runner.run('refund-status-update', { filingStage: 'approved' });
  assert.equal(record.status, 'failed');
  assert.match(record.error, /caseId/);
});

test('transcript-intake workflow gates on authorization', async () => {
  const runner = runnerFor(transcriptIntakeWorkflow);
  const denied = await runner.run('transcript-intake', { requestId: 'REQ-1', authorized: false });
  assert.equal(denied.status, 'failed');
  assert.match(denied.error, /authorization/i);

  const allowed = await runner.run('transcript-intake', {
    requestId: 'REQ-1',
    products: ['account-transcript'],
    authorized: true
  });
  assert.equal(allowed.status, 'succeeded');
  assert.equal(allowed.output.tdsPacket.sealed, true);
  assert.equal(allowed.output.tdsPacket.recordCount, 1);
});

test('transmission workflow holds transmission while tunnel is a stub', async () => {
  const runner = runnerFor(transmissionWorkflow);
  const record = await runner.run('transmission-cycle', { batchId: 'batch-alpha', documents: ['d1'] });
  assert.equal(record.status, 'succeeded');
  assert.equal(record.output.transmissionOutcome, 'held-pending-approval');
  assert.equal(record.output.acknowledgement.controlsPassed, true);
});

test('platform registry composes all modular workflows with a working trigger manager', async () => {
  assert.equal(platformWorkflows.length, 3);
  const { registry, triggers } = createPlatformRegistry();
  assert.equal(registry.list().length, 3);
  assert.deepEqual(triggers.eventNames(), ['refund.status.received']);
  assert.deepEqual(triggers.scheduledWorkflows(), ['transmission-cycle']);

  const runs = await triggers.emit('refund.status.received', { caseId: 'CASE-1', filingStage: 'sent' });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].output.refundStatus, 'refund-sent');
});
