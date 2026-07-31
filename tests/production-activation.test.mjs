import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateActivation,
  activateProduction,
  activationHeartbeat,
  ACTIVATION_STATES
} from '../packages/production-activation/src/index.mjs';
import { createPlatformRegistry, sampleInputs } from '../workers/workflow-runner/src/registry.mjs';
import {
  productionActivationDispatchWorkflow,
  productionActivationRequestedWorkflow,
  productionActivationCycleWorkflow
} from '../workflows/production-activation-workflow/src/index.mjs';

test('activation states include PRODUCTION_VERIFIED and BLOCKED', () => {
  assert.ok(ACTIVATION_STATES.includes('AUTOMATICALLY_TESTED'));
  assert.ok(ACTIVATION_STATES.includes('PRODUCTION_VERIFIED'));
  assert.ok(ACTIVATION_STATES.includes('BLOCKED'));
});

test('evaluateActivation stays automated-tested without live evidence', () => {
  const evaluation = evaluateActivation({
    gateReport: { ok: true, results: [{ id: 'lint', ok: true, required: true }] },
    evidence: {}
  });
  assert.equal(evaluation.state, 'AUTOMATICALLY_TESTED');
  assert.equal(evaluation.productionVerified, false);
  assert.ok(evaluation.gaps.includes('cloudFormationComplete'));
});

test('evaluateActivation can reach PRODUCTION_VERIFIED with full evidence', () => {
  const evaluation = evaluateActivation({
    gateReport: { ok: true, results: [] },
    evidence: {
      cloudFormationComplete: true,
      tlsIssued: true,
      dnsResolved: true,
      releaseAttestation: true,
      ownerApproved: true
    }
  });
  assert.equal(evaluation.state, 'PRODUCTION_VERIFIED');
  assert.equal(evaluation.productionVerified, true);
});

test('activateProduction with skipGates writes receipt and does not claim live verified', async () => {
  const result = await activateProduction(process.cwd(), {
    skipGates: true,
    requestedBy: 'unit-test',
    trigger: 'test'
  });
  assert.equal(result.ok, true);
  // skipGates is honest GENERATED — not AUTOMATICALLY_TESTED without running gates.
  assert.equal(result.state, 'GENERATED');
  assert.equal(result.productionVerified, false);
  assert.match(result.receipt.outPath, /build\/production-activation\//);
});

test('activation heartbeat passes for scaffold paths', async () => {
  const beat = await activationHeartbeat(process.cwd());
  assert.equal(beat.ok, true);
});

test('production activation workflows register with manual/event/schedule triggers', () => {
  assert.equal(productionActivationDispatchWorkflow.trigger.type, 'manual');
  assert.equal(productionActivationRequestedWorkflow.trigger.type, 'event');
  assert.equal(productionActivationRequestedWorkflow.trigger.on, 'production.activation.requested');
  assert.equal(productionActivationCycleWorkflow.trigger.type, 'schedule');
});

test('platform registry emits production.activation.requested automation', async () => {
  const { registry, triggers } = createPlatformRegistry();
  assert.ok(registry.has('production-activation-dispatch'));
  assert.ok(registry.has('production-activation-requested'));
  assert.ok(registry.has('production-activation-cycle'));
  assert.ok(triggers.eventNames().includes('production.activation.requested'));
  assert.ok(triggers.scheduledWorkflows().includes('production-activation-cycle'));
  assert.equal(sampleInputs['production-activation-requested'].skipGates, true);

  const runs = await triggers.emit(
    'production.activation.requested',
    sampleInputs['production-activation-requested']
  );
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, 'succeeded');
  assert.equal(runs[0].output.summary.state, 'GENERATED');
});
