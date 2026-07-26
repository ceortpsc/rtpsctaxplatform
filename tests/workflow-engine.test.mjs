import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defineTask,
  defineWorkflow,
  describeWorkflow,
  createWorkflowRegistry,
  createWorkflowRunner,
  createTriggerManager,
  RUN_STATUS
} from '../packages/workflow-engine/src/index.mjs';

test('defineTask validates inputs', () => {
  assert.throws(() => defineTask({ name: '', run: () => {} }), /name/);
  assert.throws(() => defineTask({ name: 'x' }), /run/);
  const task = defineTask({ name: 'x', run: () => ({ ok: true }) });
  assert.equal(task.kind, 'task');
});

test('defineWorkflow validates trigger and steps', () => {
  const step = defineTask({ name: 's', run: () => ({}) });
  assert.throws(() => defineWorkflow({ name: 'w', steps: [] }), /at least one step/);
  assert.throws(() => defineWorkflow({ name: 'w', trigger: { type: 'nope' }, steps: [step] }), /trigger\.type/);
  assert.throws(() => defineWorkflow({ name: 'w', trigger: { type: 'schedule' }, steps: [step] }), /everyMs/);
  assert.throws(() => defineWorkflow({ name: 'w', trigger: { type: 'event' }, steps: [step] }), /trigger\.on/);
  const wf = defineWorkflow({ name: 'w', steps: [step] });
  assert.equal(wf.trigger.type, 'manual');
});

test('describeWorkflow omits functions and is JSON-serializable', () => {
  const wf = defineWorkflow({
    name: 'w',
    description: 'demo',
    steps: [defineTask({ name: 's', description: 'd', run: () => ({}) })]
  });
  const described = describeWorkflow(wf);
  assert.deepEqual(described.steps, [{ name: 's', description: 'd' }]);
  assert.doesNotThrow(() => JSON.stringify(described));
});

test('runner executes steps, threads state, and records success', async () => {
  const wf = defineWorkflow({
    name: 'chain',
    steps: [
      defineTask({ name: 'a', run: (ctx) => ({ a: ctx.input.seed + 1 }) }),
      defineTask({ name: 'b', run: (ctx) => ({ b: ctx.state.a * 2 }) })
    ]
  });
  const registry = createWorkflowRegistry([wf]);
  const runner = createWorkflowRunner({ registry });
  const record = await runner.run('chain', { seed: 4 });

  assert.equal(record.status, RUN_STATUS.SUCCEEDED);
  assert.equal(record.output.a, 5);
  assert.equal(record.output.b, 10);
  assert.equal(record.steps.length, 2);
  assert.ok(record.steps.every((s) => s.status === RUN_STATUS.SUCCEEDED));
  assert.equal(runner.stats().succeeded, 1);
});

test('runner captures failures and stops the workflow', async () => {
  const wf = defineWorkflow({
    name: 'boom',
    steps: [
      defineTask({ name: 'ok', run: () => ({ ok: true }) }),
      defineTask({ name: 'explode', run: () => { throw new Error('kaboom'); } }),
      defineTask({ name: 'never', run: () => ({ never: true }) })
    ]
  });
  const registry = createWorkflowRegistry([wf]);
  const runner = createWorkflowRunner({ registry });
  const record = await runner.run('boom', {});

  assert.equal(record.status, RUN_STATUS.FAILED);
  assert.match(record.error, /explode.*kaboom/);
  assert.equal(record.steps.length, 2, 'should not run steps after a failure');
  assert.equal(record.steps[1].status, RUN_STATUS.FAILED);
});

test('trigger manager fires manual and event workflows', async () => {
  const manual = defineWorkflow({
    name: 'm',
    steps: [defineTask({ name: 's', run: (ctx) => ({ got: ctx.input.value }) })]
  });
  const eventWf = defineWorkflow({
    name: 'e',
    trigger: { type: 'event', on: 'ping' },
    steps: [defineTask({ name: 's', run: (ctx) => ({ pong: ctx.input.n }) })]
  });
  const registry = createWorkflowRegistry([manual, eventWf]);
  const runner = createWorkflowRunner({ registry });
  const triggers = createTriggerManager({ registry, runner });

  const manualRun = await triggers.fireManual('m', { value: 42 });
  assert.equal(manualRun.output.got, 42);
  assert.equal(manualRun.trigger, 'manual');

  const eventRuns = await triggers.emit('ping', { n: 7 });
  assert.equal(eventRuns.length, 1);
  assert.equal(eventRuns[0].output.pong, 7);
  assert.equal(eventRuns[0].trigger, 'event:ping');
  assert.deepEqual(triggers.eventNames(), ['ping']);
});
