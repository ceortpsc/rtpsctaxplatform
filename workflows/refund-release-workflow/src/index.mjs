import { defineTask, defineWorkflow } from '../../../packages/workflow-engine/src/index.mjs';
import { processMasterfileRecord } from '../../../pipelines/masterfile-pipeline/src/index.mjs';
import { createRefundReleaseStore } from '../../../packages/refund-release-core/src/index.mjs';
import { buildRefundIntelligence } from '../../../engines/refund-intelligence-engine/src/index.mjs';
import { askAssist } from '../../../packages/ai-assist/src/index.mjs';

const sharedStore = createRefundReleaseStore();

export const validateReleaseInputTask = defineTask({
  name: 'validate-release-input',
  description: 'Validate case, taxpayer, and amount for refund release after TC rectification.',
  run: (context) => {
    const { caseId, taxpayerRef, amount } = context.input;
    if (!caseId) throw new Error('caseId is required.');
    if (!taxpayerRef) throw new Error('taxpayerRef is required.');
    if (amount == null || Number.isNaN(Number(amount))) throw new Error('amount is required.');
    context.log(`Validated refund release input for ${caseId}.`);
    return {
      caseId: String(caseId),
      taxpayerRef: String(taxpayerRef),
      amount: Number(amount),
      rectifyCodes: context.input.rectifyCodes || ['570', '810'],
      operator: context.input.operator || 'ero'
    };
  }
});

export const rectifyMasterfileTask = defineTask({
  name: 'rectify-masterfile-holds',
  description: 'Run masterfile pipeline and rectify TC 570 / 810 holds.',
  run: (context) => {
    const masterfile = processMasterfileRecord({
      caseId: context.state.caseId,
      taxpayerRef: context.state.taxpayerRef,
      transactionCodes: context.input.transactionCodes,
      rectifyCodes: context.state.rectifyCodes,
      operator: context.state.operator,
      notes: context.input.notes
    });
    if (!masterfile.gate?.eligible) {
      throw new Error(`Release gate blocked: ${(masterfile.gate?.reasons || []).join(' ')}`);
    }
    context.log(`Masterfile rectified; open holds=${masterfile.analysis.openHolds.length}.`);
    return { masterfile };
  }
});

export const applyReleaseIntelligenceTask = defineTask({
  name: 'apply-release-intelligence',
  description: 'Score refund intelligence and AI assist guidance for release.',
  run: (context) => {
    const intelligence = buildRefundIntelligence({
      signals: {
        wmrStatus: 'APPROVED',
        masterfileStatus: 'APPROVED',
        transcriptStatus: 'ACCEPTED'
      }
    });
    const assist = askAssist(
      `Refund release after TC 570/810 rectification for case ${context.state.caseId}`
    );
    context.log(`Intelligence guard=${intelligence.guardLevel?.level}; assist ok=${assist.ok}.`);
    return { intelligence, assist };
  }
});

export const requestApproveIssueTask = defineTask({
  name: 'request-approve-issue-reconcile',
  description: 'Request release, approve, scaffold-issue, and reconcile.',
  run: (context) => {
    const release = sharedStore.requestRelease({
      caseId: context.state.caseId,
      taxpayerRef: context.state.taxpayerRef,
      amount: context.state.amount,
      transactionCodes: context.state.masterfile.analysis.codes,
      masterfileRectified: true,
      requestedBy: context.state.operator,
      intelligence: context.state.intelligence
    });
    const approved = sharedStore.approveRelease(release.id, { approver: context.state.operator });
    const issued = sharedStore.issueRefund(approved.id, { issuer: context.state.operator, scaffoldOnly: true });
    const reconciliation = sharedStore.reconcile({
      releaseRequestId: issued.id,
      caseId: context.state.caseId,
      taxpayerRef: context.state.taxpayerRef,
      amount: context.state.amount
    });
    context.log(`Release ${issued.id} status=${issued.status}; reconcile=${reconciliation.status}.`);
    return { release: issued, reconciliation };
  }
});

export const emitReleaseEventsTask = defineTask({
  name: 'emit-release-events',
  description: 'Assemble outbound refund release / reconcile events.',
  run: (context) => ({
    emittedEvent: {
      type: 'refund.release.completed',
      caseId: context.state.caseId,
      requestId: context.state.release.id,
      status: context.state.release.status,
      reconciliationId: context.state.reconciliation.id,
      balanced: context.state.reconciliation.balanced,
      issued: context.state.release.issued === true
    }
  })
});

export const refundReleaseWorkflow = defineWorkflow({
  name: 'refund-release-after-tc-rectify',
  description:
    'Rectify masterfile TC 570/810 holds, run intelligence + AI assist, request/approve/issue refund release, and reconcile.',
  trigger: { type: 'event', on: 'masterfile.tc.rectified' },
  tags: ['refund', 'masterfile', 'ero', 'event-driven'],
  steps: [
    validateReleaseInputTask,
    rectifyMasterfileTask,
    applyReleaseIntelligenceTask,
    requestApproveIssueTask,
    emitReleaseEventsTask
  ]
});

export const refundReleaseRequestWorkflow = defineWorkflow({
  name: 'refund-release-request',
  description: 'Operator-triggered refund release lifecycle after holds are cleared.',
  trigger: { type: 'event', on: 'refund.release.requested' },
  tags: ['refund', 'ero', 'manual'],
  steps: [
    validateReleaseInputTask,
    rectifyMasterfileTask,
    applyReleaseIntelligenceTask,
    requestApproveIssueTask,
    emitReleaseEventsTask
  ]
});
