// Agent assignment workflows — thin re-export so the workflow lives under
// workflows/* like the other platform workflows, while the implementation
// stays in agent-core (assignment board + bridge).

export {
  agentAssignmentDispatchWorkflow,
  agentTaskRequestedWorkflow,
  agentAssignmentCycleWorkflow,
  agentAssignmentWorkflows
} from '../../../packages/agent-core/src/assignment-workflows.mjs';
