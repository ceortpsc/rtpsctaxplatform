import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_ASSIGNMENTS,
  defineAssignment,
  createAssignmentBoard,
  ASSIGNMENT_STATUSES
} from '../packages/agent-core/src/assignments.mjs';
import { createPlatformAssignmentBoard, runRequiredAssignments } from '../packages/agent-core/src/dispatch.mjs';
import {
  agentAssignmentWorkflows,
  agentAssignmentDispatchWorkflow,
  agentTaskRequestedWorkflow,
  agentAssignmentCycleWorkflow
} from '../packages/agent-core/src/assignment-workflows.mjs';
import {
  createWorkflowRegistry,
  createWorkflowRunner,
  createTriggerManager
} from '../packages/workflow-engine/src/index.mjs';
import { createPlatformRegistry, platformWorkflows, sampleInputs } from '../workers/workflow-runner/src/registry.mjs';

test('required assignments cover every development-team agent at least once', () => {
  const agents = new Set(REQUIRED_ASSIGNMENTS.map((a) => a.agent));
  for (const name of [
    'planning-agent',
    'scoping-agent',
    'testing-agent',
    'mapping-agent',
    'staging-agent',
    'assessment-agent',
    'seo-ownership-agent',
    'markdown-agent'
  ]) {
    assert.ok(agents.has(name), `${name} should have a required assignment`);
  }
  assert.ok(REQUIRED_ASSIGNMENTS.every((a) => a.kind === 'assignment'));
});

test('defineAssignment validates trigger shapes', () => {
  assert.throws(() => defineAssignment({ id: '', title: 'x', agent: 'a' }), /id/);
  assert.throws(() => defineAssignment({ id: 'x', title: 't', agent: 'a', trigger: { type: 'nope' } }), /trigger/);
  assert.throws(
    () => defineAssignment({ id: 'x', title: 't', agent: 'a', trigger: { type: 'event' } }),
    /trigger\.on/
  );
});

test('assignment board assigns and runs a targeted agent task', async () => {
  const calls = [];
  const fakeAgent = {
    name: 'planning-agent',
    title: 'Planning',
    run: async () => {
      calls.push('ran');
      return { summary: 'ok', sections: [{ heading: 'Plan' }], data: {} };
    }
  };
  const board = createAssignmentBoard({
    agents: [fakeAgent],
    assignments: [
      defineAssignment({
        id: 'plan-delivery',
        title: 'Plan',
        agent: 'planning-agent',
        trigger: { type: 'manual' }
      })
    ],
    buildContext: () => ({ catalog: [] }),
    runAgent: async (agent, context) => {
      const report = await agent.run(context);
      return { agent: agent.name, status: 'ok', summary: report.summary, sections: report.sections, data: report.data };
    }
  });

  const listed = board.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].status, ASSIGNMENT_STATUSES.ASSIGNED);

  const batch = await board.run({ assignmentId: 'plan-delivery' });
  assert.equal(batch.executed, 1);
  assert.equal(batch.succeeded, 1);
  assert.equal(calls.length, 1);
  assert.equal(board.get('plan-delivery').status, ASSIGNMENT_STATUSES.SUCCEEDED);
});

test('event and schedule triggers filter the correct assignments', async () => {
  const agents = ['testing-agent', 'assessment-agent'].map((name) => ({
    name,
    title: name,
    run: async () => ({ summary: name, sections: [], data: {} })
  }));
  const board = createAssignmentBoard({
    agents,
    assignments: [
      defineAssignment({
        id: 'validate-platform',
        title: 'Validate',
        agent: 'testing-agent',
        trigger: { type: 'event', on: 'agent.task.requested' }
      }),
      defineAssignment({
        id: 'assess-environment',
        title: 'Assess',
        agent: 'assessment-agent',
        trigger: { type: 'event', on: 'agent.task.requested' }
      }),
      defineAssignment({
        id: 'agent-cycle-health',
        title: 'Cycle',
        agent: 'testing-agent',
        trigger: { type: 'schedule', everyMs: 120000 }
      })
    ],
    buildContext: () => ({}),
    runAgent: async (agent) => {
      const report = await agent.run({});
      return { agent: agent.name, status: 'ok', summary: report.summary, sections: [], data: {} };
    }
  });

  const eventBatch = await board.fireTrigger('event', { event: 'agent.task.requested' });
  assert.equal(eventBatch.executed, 2);
  assert.ok(eventBatch.results.every((r) => r.trigger === 'event:agent.task.requested'));

  const scheduleBatch = await board.fireTrigger('schedule', {});
  assert.equal(scheduleBatch.executed, 1);
  assert.equal(scheduleBatch.results[0].assignmentId, 'agent-cycle-health');
});

test('platform assignment board runs a required assignment end-to-end', async () => {
  const board = createPlatformAssignmentBoard();
  assert.ok(board.list({ requiredOnly: true }).length >= 7);
  const batch = await board.run({ assignmentId: 'validate-platform' });
  assert.equal(batch.failed, 0);
  assert.equal(batch.results[0].agent, 'testing-agent');
  assert.equal(batch.results[0].status, 'succeeded');
});

test('agent-assignment workflows are registered with manual/event/schedule triggers', () => {
  assert.equal(agentAssignmentWorkflows.length, 3);
  assert.equal(agentAssignmentDispatchWorkflow.trigger.type, 'manual');
  assert.equal(agentTaskRequestedWorkflow.trigger.type, 'event');
  assert.equal(agentTaskRequestedWorkflow.trigger.on, 'agent.task.requested');
  assert.equal(agentAssignmentCycleWorkflow.trigger.type, 'schedule');
  assert.ok(agentAssignmentCycleWorkflow.trigger.everyMs > 0);
});

test('agent-assignment-dispatch workflow executes an assigned agent via trigger manager', async () => {
  const registry = createWorkflowRegistry([agentAssignmentDispatchWorkflow]);
  const runner = createWorkflowRunner({ registry });
  const triggers = createTriggerManager({ registry, runner });
  const record = await triggers.fireManual('agent-assignment-dispatch', { assignmentId: 'scope-inventory' });
  assert.equal(record.status, 'succeeded');
  assert.equal(record.output.assignmentSummary.executed, 1);
  assert.deepEqual(record.output.assignmentSummary.agents, ['scoping-agent']);
});

test('agent.task.requested event trigger runs subscribed assignments', async () => {
  const registry = createWorkflowRegistry([agentTaskRequestedWorkflow]);
  const runner = createWorkflowRunner({ registry });
  const triggers = createTriggerManager({ registry, runner });
  const runs = await triggers.emit('agent.task.requested', { assignmentId: 'validate-platform' });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, 'succeeded');
  assert.match(runs[0].trigger, /event:agent\.task\.requested/);
});

test('platform registry includes agent-assignment workflows and sample inputs', async () => {
  assert.ok(platformWorkflows.length >= 6);
  const { registry, triggers } = createPlatformRegistry();
  assert.ok(registry.has('agent-assignment-dispatch'));
  assert.ok(registry.has('agent-task-requested'));
  assert.ok(registry.has('agent-assignment-cycle'));
  assert.ok(triggers.eventNames().includes('agent.task.requested'));
  assert.ok(triggers.scheduledWorkflows().includes('agent-assignment-cycle'));
  assert.equal(sampleInputs['agent-assignment-dispatch'].assignmentId, 'validate-platform');

  const runs = await triggers.emit('agent.task.requested', sampleInputs['agent-task-requested']);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, 'succeeded');
});

test('runRequiredAssignments executes the full required set', async () => {
  const result = await runRequiredAssignments();
  assert.ok(result.batch.executed >= 7);
  assert.equal(result.batch.failed, 0);
  assert.ok(result.board.requiredCount >= 7);
});
