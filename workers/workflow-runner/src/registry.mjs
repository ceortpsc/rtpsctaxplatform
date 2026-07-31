import {
  createTriggerManager,
  createWorkflowRegistry,
  createWorkflowRunner
} from '../../../packages/workflow-engine/src/index.mjs';
import { refundStatusWorkflow } from '../../../workflows/refund-status-workflow/src/index.mjs';
import { transcriptIntakeWorkflow } from '../../../workflows/transcript-intake-workflow/src/index.mjs';
import { transmissionWorkflow } from '../../../workflows/transmission-workflow/src/index.mjs';
import {
  agentAssignmentDispatchWorkflow,
  agentTaskRequestedWorkflow,
  agentAssignmentCycleWorkflow
} from '../../../workflows/agent-assignment-workflow/src/index.mjs';
import {
  productionActivationDispatchWorkflow,
  productionActivationRequestedWorkflow,
  productionActivationCycleWorkflow
} from '../../../workflows/production-activation-workflow/src/index.mjs';

// Central composition point for the background workflow runner: registers every
// modular workflow and wires a runner + trigger manager. Workflows execute here
// in the background (schedules/events), not from any dashboard.
export const platformWorkflows = [
  refundStatusWorkflow,
  transcriptIntakeWorkflow,
  transmissionWorkflow,
  agentAssignmentDispatchWorkflow,
  agentTaskRequestedWorkflow,
  agentAssignmentCycleWorkflow,
  productionActivationDispatchWorkflow,
  productionActivationRequestedWorkflow,
  productionActivationCycleWorkflow
];

// Representative inputs used to drive workflows during background cycles.
// Agent-assignment samples target a single lightweight assignment so the
// 15s background cycle does not re-run the full development team every tick.
// Production activation event sample uses skipGates so the 15s cycle stays light;
// full gated activation is via CLI / explicit workflow run / event with skipGates:false.
export const sampleInputs = Object.freeze({
  'refund-status-update': { caseId: 'CASE-10042', taxpayerRef: 'TP-88', filingStage: 'approved' },
  'transcript-intake': { requestId: 'REQ-2201', products: ['account-transcript', 'tds-packet'], authorized: true },
  'transmission-cycle': { batchId: 'scheduled-batch', documents: ['doc-1', 'doc-2'] },
  'agent-assignment-dispatch': { assignmentId: 'validate-platform' },
  'agent-task-requested': { assignmentId: 'validate-platform' },
  'agent-assignment-cycle': {},
  'production-activation-dispatch': {
    mode: 'automated',
    skipGates: true,
    requestedBy: 'workflow-sample'
  },
  'production-activation-requested': {
    mode: 'automated',
    skipGates: true,
    requestedBy: 'workflow-sample'
  },
  'production-activation-cycle': {}
});

export function createPlatformRegistry() {
  const registry = createWorkflowRegistry(platformWorkflows);
  const runner = createWorkflowRunner({ registry, historyLimit: 200 });
  const triggers = createTriggerManager({ registry, runner });
  return { registry, runner, triggers };
}
