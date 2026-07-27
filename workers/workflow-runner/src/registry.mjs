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
  refundReleaseWorkflow,
  refundReleaseRequestWorkflow
} from '../../../workflows/refund-release-workflow/src/index.mjs';

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
  refundReleaseWorkflow,
  refundReleaseRequestWorkflow
];

// Representative inputs used to drive workflows during background cycles.
// Agent-assignment samples target a single lightweight assignment so the
// 15s background cycle does not re-run the full development team every tick.
export const sampleInputs = Object.freeze({
  'refund-status-update': { caseId: 'CASE-10042', taxpayerRef: 'TP-88', filingStage: 'approved' },
  'transcript-intake': { requestId: 'REQ-2201', products: ['account-transcript', 'tds-packet'], authorized: true },
  'transmission-cycle': { batchId: 'scheduled-batch', documents: ['doc-1', 'doc-2'] },
  'agent-assignment-dispatch': { assignmentId: 'validate-platform' },
  'agent-task-requested': { assignmentId: 'validate-platform' },
  'agent-assignment-cycle': {},
  'refund-release-after-tc-rectify': {
    caseId: 'UF-2026-001',
    taxpayerRef: 'TP-UF-001',
    amount: 3200,
    rectifyCodes: ['570', '810']
  },
  'refund-release-request': {
    caseId: 'UF-2026-002',
    taxpayerRef: 'TP-UF-002',
    amount: 2800,
    rectifyCodes: ['570', '810']
  }
});

export function createPlatformRegistry() {
  const registry = createWorkflowRegistry(platformWorkflows);
  const runner = createWorkflowRunner({ registry, historyLimit: 200 });
  const triggers = createTriggerManager({ registry, runner });
  return { registry, runner, triggers };
}
