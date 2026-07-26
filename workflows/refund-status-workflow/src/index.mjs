import { defineTask, defineWorkflow } from '../../../packages/workflow-engine/src/index.mjs';

// Event-driven refund status workflow. Triggered when a `refund.status.received`
// event is emitted. All processing is on compliant, in-memory (simulated) data;
// no external IRS/system access is performed.

const FILING_STAGE_STATUS = {
  received: 'return-received',
  processing: 'return-processing',
  approved: 'refund-approved',
  sent: 'refund-sent'
};

export const normalizeRequestTask = defineTask({
  name: 'normalize-request',
  description: 'Validate and normalize the inbound refund status request.',
  run: (context) => {
    const { caseId, taxpayerRef, filingStage = 'received' } = context.input;
    if (!caseId) {
      throw new Error('caseId is required to evaluate refund status.');
    }
    context.log(`Normalizing refund request for case ${caseId}.`);
    return {
      caseId: String(caseId),
      taxpayerRef: taxpayerRef ? String(taxpayerRef) : 'unknown',
      filingStage: String(filingStage).toLowerCase()
    };
  }
});

export const evaluateStatusTask = defineTask({
  name: 'evaluate-status',
  description: 'Derive a normalized refund status code from the filing stage.',
  run: (context) => {
    const status = FILING_STAGE_STATUS[context.state.filingStage] ?? 'status-unavailable';
    context.log(`Refund status resolved to ${status}.`);
    return { refundStatus: status };
  }
});

export const applyIntelligenceTask = defineTask({
  name: 'apply-intelligence',
  description: 'Compute a deterministic refund-intelligence risk score.',
  run: (context) => {
    // Deterministic score derived from the case id so runs are reproducible.
    const digits = [...context.state.caseId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const riskScore = digits % 100;
    const priority = riskScore >= 75 ? 'high' : riskScore >= 40 ? 'medium' : 'low';
    context.log(`Risk score ${riskScore} (${priority} priority).`);
    return { riskScore, priority };
  }
});

export const emitStatusEventTask = defineTask({
  name: 'emit-status-event',
  description: 'Assemble the outbound refund.status.updated event payload.',
  run: (context) => ({
    emittedEvent: {
      type: 'refund.status.updated',
      caseId: context.state.caseId,
      refundStatus: context.state.refundStatus,
      priority: context.state.priority,
      riskScore: context.state.riskScore
    }
  })
});

export const refundStatusWorkflow = defineWorkflow({
  name: 'refund-status-update',
  description: 'Normalize a refund request, evaluate status, score risk, and emit an update event.',
  trigger: { type: 'event', on: 'refund.status.received' },
  tags: ['refund', 'event-driven'],
  steps: [normalizeRequestTask, evaluateStatusTask, applyIntelligenceTask, emitStatusEventTask]
});
