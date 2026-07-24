import { defineTask, defineWorkflow } from '../../../packages/workflow-engine/src/index.mjs';
import { createSecureTunnelAdapter } from '../../../packages/secure-tunnel/src/index.mjs';

// Scheduled transmission workflow mirroring the platform transmission flow:
// prepare -> validate -> queue -> transmit -> acknowledge. The transmit step is
// gated on the secure tunnel adapter; while the adapter is a stub it records a
// "held" outcome rather than performing any real transmission (compliance safe).

export const preparePayloadTask = defineTask({
  name: 'prepare-payload',
  description: 'Assemble a transmission payload from the batch input.',
  run: (context) => {
    const { batchId = `batch-${Date.now().toString(36)}`, documents = [] } = context.input;
    context.log(`Preparing payload for ${batchId} (${documents.length} document(s)).`);
    return { batchId, documentCount: documents.length };
  }
});

export const validateControlsTask = defineTask({
  name: 'validate-controls',
  description: 'Run compliance/control checks over the prepared payload.',
  run: (context) => {
    const passedControls = ['schema', 'compliance-notice', 'secret-source'];
    context.log('Control checks passed.');
    return { controls: passedControls, controlsPassed: true };
  }
});

export const queueTransmissionTask = defineTask({
  name: 'queue-transmission',
  description: 'Queue the validated payload for transmission.',
  run: (context) => {
    context.log('Queued for transmission.');
    return { queued: true };
  }
});

export const transmitTask = defineTask({
  name: 'transmit',
  description: 'Hand off to the approved secure tunnel adapter (stub-safe).',
  run: (context) => {
    const tunnel = createSecureTunnelAdapter();
    const outcome = tunnel.status === 'stub' ? 'held-pending-approval' : 'transmitted';
    context.log(`Secure tunnel status "${tunnel.status}" -> outcome "${outcome}".`);
    return { tunnel: tunnel.name, transmissionOutcome: outcome };
  }
});

export const acknowledgeTask = defineTask({
  name: 'acknowledge',
  description: 'Record the transmission acknowledgement result.',
  run: (context) => ({
    acknowledgement: {
      batchId: context.state.batchId,
      outcome: context.state.transmissionOutcome,
      controlsPassed: context.state.controlsPassed === true
    }
  })
});

export const transmissionWorkflow = defineWorkflow({
  name: 'transmission-cycle',
  description: 'Prepare, validate, queue, transmit (stub-safe), and acknowledge a transmission batch.',
  trigger: { type: 'schedule', everyMs: 60000, input: { batchId: 'scheduled-batch', documents: [] } },
  tags: ['transmission', 'scheduled'],
  steps: [preparePayloadTask, validateControlsTask, queueTransmissionTask, transmitTask, acknowledgeTask]
});
