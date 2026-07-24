import {
  createTriggerManager,
  createWorkflowRegistry,
  createWorkflowRunner
} from '../../../packages/workflow-engine/src/index.mjs';
import { refundStatusWorkflow } from '../../../workflows/refund-status-workflow/src/index.mjs';
import { transcriptIntakeWorkflow } from '../../../workflows/transcript-intake-workflow/src/index.mjs';
import { transmissionWorkflow } from '../../../workflows/transmission-workflow/src/index.mjs';

// Central composition point: registers every modular workflow and wires a runner
// and trigger manager. Both the HTTP dashboard and the CLI consume this factory.
export const platformWorkflows = [refundStatusWorkflow, transcriptIntakeWorkflow, transmissionWorkflow];

export function createPlatformRegistry() {
  const registry = createWorkflowRegistry(platformWorkflows);
  const runner = createWorkflowRunner({ registry, historyLimit: 200 });
  const triggers = createTriggerManager({ registry, runner });
  return { registry, runner, triggers };
}
