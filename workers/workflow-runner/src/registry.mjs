import {
  createTriggerManager,
  createWorkflowRegistry,
  createWorkflowRunner
} from '../../../packages/workflow-engine/src/index.mjs';
import { refundStatusWorkflow } from '../../../workflows/refund-status-workflow/src/index.mjs';
import { transcriptIntakeWorkflow } from '../../../workflows/transcript-intake-workflow/src/index.mjs';
import { transmissionWorkflow } from '../../../workflows/transmission-workflow/src/index.mjs';

// Central composition point for the background workflow runner: registers every
// modular workflow and wires a runner + trigger manager. Workflows execute here
// in the background (schedules/events), not from any dashboard.
export const platformWorkflows = [refundStatusWorkflow, transcriptIntakeWorkflow, transmissionWorkflow];

// Representative inputs used to drive workflows during background cycles.
export const sampleInputs = Object.freeze({
  'refund-status-update': { caseId: 'CASE-10042', taxpayerRef: 'TP-88', filingStage: 'approved' },
  'transcript-intake': { requestId: 'REQ-2201', products: ['account-transcript', 'tds-packet'], authorized: true },
  'transmission-cycle': { batchId: 'scheduled-batch', documents: ['doc-1', 'doc-2'] }
});

export function createPlatformRegistry() {
  const registry = createWorkflowRegistry(platformWorkflows);
  const runner = createWorkflowRunner({ registry, historyLimit: 200 });
  const triggers = createTriggerManager({ registry, runner });
  return { registry, runner, triggers };
}
