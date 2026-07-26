// Agent-assignment workflows: bridge the assignment board into the modular
// workflow-engine (manual + event + schedule triggers).
//
// Top-level imports stay limited to workflow-engine so the workflow-runner
// registry can import these workflows without forming a cycle through
// agent-core → registry → workflows → agent-core.

import { defineTask, defineWorkflow } from '../../workflow-engine/src/index.mjs';

async function getBoard() {
  const { createPlatformAssignmentBoard } = await import('./dispatch.mjs');
  return createPlatformAssignmentBoard();
}

const resolveTargetsTask = defineTask({
  name: 'resolve-assignment-targets',
  description: 'Resolve which agent assignments the trigger should execute.',
  run: async (context) => {
    const board = await getBoard();
    const input = context.input ?? {};
    let targets;
    if (input.assignmentId) {
      const one = board.get(input.assignmentId);
      if (!one) throw new Error(`Unknown assignmentId "${input.assignmentId}".`);
      targets = [one];
    } else if (input.agent) {
      targets = board.list({ agent: input.agent });
      if (targets.length === 0) throw new Error(`No assignments for agent "${input.agent}".`);
    } else if (context.trigger?.startsWith?.('event:') || context.input?.event) {
      targets = board.list().filter((a) => a.trigger.type === 'event');
    } else if (context.trigger === 'schedule') {
      targets = board.list().filter((a) => a.trigger.type === 'schedule');
    } else {
      targets = board.list({ requiredOnly: true });
    }
    context.log?.(`Resolved ${targets.length} assignment target(s).`);
    return {
      targets: targets.map((t) => ({ id: t.id, agent: t.agent, title: t.title, trigger: t.trigger }))
    };
  }
});

const executeAssignmentsTask = defineTask({
  name: 'execute-assigned-agents',
  description: 'Run each assigned agent for the resolved targets.',
  run: async (context) => {
    const board = await getBoard();
    const input = { ...(context.input ?? {}) };
    const trigger = context.trigger ?? 'manual';

    let meta = { trigger };
    if (typeof trigger === 'string' && trigger.startsWith('event:')) {
      meta = { trigger, eventName: trigger.slice('event:'.length), triggerType: 'event' };
    } else if (trigger === 'schedule') {
      meta = { trigger: 'schedule', triggerType: 'schedule' };
    } else {
      meta = { trigger: 'manual', triggerType: 'manual' };
    }

    // When the workflow was event-triggered without a specific assignment/agent,
    // prefer the board's event filter. For explicit assignmentId/agent, run those.
    const batch = await board.run(input, meta);
    if (batch.failed > 0) {
      throw new Error(
        `Agent assignment batch failed (${batch.failed}/${batch.executed}): ${
          batch.results
            .filter((r) => r.status === 'failed')
            .map((r) => `${r.assignmentId}:${r.error ?? r.report?.error ?? 'error'}`)
            .join('; ')
        }`
      );
    }
    context.log?.(`Executed ${batch.executed} assignment(s); ${batch.succeeded} succeeded.`);
    return {
      assignmentBatch: batch,
      agentsExecuted: batch.results.map((r) => r.agent)
    };
  }
});

const summarizeAssignmentTask = defineTask({
  name: 'summarize-assignment-run',
  description: 'Summarize assignment outcomes for run history / operators.',
  run: (context) => {
    const batch = context.state.assignmentBatch;
    return {
      assignmentSummary: {
        trigger: batch?.trigger ?? context.trigger,
        executed: batch?.executed ?? 0,
        succeeded: batch?.succeeded ?? 0,
        failed: batch?.failed ?? 0,
        assignmentIds: (batch?.results ?? []).map((r) => r.assignmentId),
        agents: (batch?.results ?? []).map((r) => r.agent)
      }
    };
  }
});

/** Manual workflow: dispatch required (or targeted) agent assignments. */
export const agentAssignmentDispatchWorkflow = defineWorkflow({
  name: 'agent-assignment-dispatch',
  description: 'Assign and execute development-team agents for required platform tasks.',
  trigger: { type: 'manual' },
  tags: ['agents', 'assignments', 'manual'],
  steps: [resolveTargetsTask, executeAssignmentsTask, summarizeAssignmentTask]
});

/** Event workflow: react to agent.task.requested and run matching assignments. */
export const agentTaskRequestedWorkflow = defineWorkflow({
  name: 'agent-task-requested',
  description: 'Event-driven agent task trigger — runs assignments subscribed to agent.task.requested.',
  trigger: { type: 'event', on: 'agent.task.requested' },
  tags: ['agents', 'assignments', 'event'],
  steps: [resolveTargetsTask, executeAssignmentsTask, summarizeAssignmentTask]
});

/** Scheduled workflow: periodic agent-assignment health cycle. */
export const agentAssignmentCycleWorkflow = defineWorkflow({
  name: 'agent-assignment-cycle',
  description: 'Scheduled agent assignment cycle for health/validation tasks.',
  trigger: { type: 'schedule', everyMs: 120000 },
  tags: ['agents', 'assignments', 'schedule'],
  steps: [resolveTargetsTask, executeAssignmentsTask, summarizeAssignmentTask]
});

export const agentAssignmentWorkflows = Object.freeze([
  agentAssignmentDispatchWorkflow,
  agentTaskRequestedWorkflow,
  agentAssignmentCycleWorkflow
]);
