// Modular workflow engine for the RTPSC Tax Platform scaffold.
//
// The engine is intentionally dependency-free (Node built-ins only) and models
// three concepts:
//   - Task:     a single named unit of executable work: run(context) -> patch.
//   - Workflow: an ordered list of task steps plus a trigger declaration.
//   - Trigger:  how a workflow starts (manual | schedule | event).
//
// A WorkflowRunner executes workflows, threads state between steps, and records
// a structured, inspectable run history. A TriggerManager wires schedule/event
// triggers to the runner so workflows can fire without manual invocation.

export const TRIGGER_TYPES = Object.freeze(['manual', 'schedule', 'event']);
export const RUN_STATUS = Object.freeze({
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed'
});

/**
 * Define a reusable, executable task.
 * @param {{ name: string, description?: string, run: (context: object) => (object|void|Promise<object|void>) }} spec
 */
export function defineTask({ name, description = '', run }) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('defineTask: "name" is required and must be a non-empty string.');
  }
  if (typeof run !== 'function') {
    throw new TypeError(`defineTask: task "${name}" requires a run(context) function.`);
  }
  return Object.freeze({ kind: 'task', name, description, run });
}

function validateTrigger(name, trigger) {
  if (!trigger || typeof trigger !== 'object') {
    throw new TypeError(`defineWorkflow: workflow "${name}" has an invalid trigger.`);
  }
  if (!TRIGGER_TYPES.includes(trigger.type)) {
    throw new TypeError(
      `defineWorkflow: workflow "${name}" trigger.type must be one of ${TRIGGER_TYPES.join(', ')}.`
    );
  }
  if (trigger.type === 'schedule' && !(Number(trigger.everyMs) > 0)) {
    throw new TypeError(`defineWorkflow: scheduled workflow "${name}" requires a positive trigger.everyMs.`);
  }
  if (trigger.type === 'event' && (typeof trigger.on !== 'string' || trigger.on.trim() === '')) {
    throw new TypeError(`defineWorkflow: event workflow "${name}" requires a non-empty trigger.on event name.`);
  }
  return Object.freeze({ ...trigger });
}

/**
 * Define a workflow: an ordered set of task steps plus a trigger declaration.
 * @param {{ name: string, description?: string, trigger?: object, steps: object[], tags?: string[] }} spec
 */
export function defineWorkflow({ name, description = '', trigger = { type: 'manual' }, steps = [], tags = [] }) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('defineWorkflow: "name" is required and must be a non-empty string.');
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new TypeError(`defineWorkflow: workflow "${name}" requires at least one step.`);
  }
  steps.forEach((step, index) => {
    if (!step || typeof step.run !== 'function' || typeof step.name !== 'string') {
      throw new TypeError(
        `defineWorkflow: workflow "${name}" step at index ${index} must be a task created with defineTask().`
      );
    }
  });

  return Object.freeze({
    kind: 'workflow',
    name,
    description,
    trigger: validateTrigger(name, trigger),
    steps: Object.freeze([...steps]),
    tags: Object.freeze([...tags])
  });
}

/** Serializable view of a workflow (safe for JSON APIs, omits functions). */
export function describeWorkflow(workflow) {
  return {
    name: workflow.name,
    description: workflow.description,
    trigger: { ...workflow.trigger },
    tags: [...workflow.tags],
    steps: workflow.steps.map((step) => ({ name: step.name, description: step.description }))
  };
}

/** In-memory registry of workflows keyed by unique name. */
export function createWorkflowRegistry(initialWorkflows = []) {
  const workflows = new Map();

  function register(workflow) {
    if (!workflow || workflow.kind !== 'workflow') {
      throw new TypeError('registry.register: expected a workflow created with defineWorkflow().');
    }
    if (workflows.has(workflow.name)) {
      throw new Error(`registry.register: workflow "${workflow.name}" is already registered.`);
    }
    workflows.set(workflow.name, workflow);
    return workflow;
  }

  initialWorkflows.forEach(register);

  return {
    register,
    get: (name) => workflows.get(name) ?? null,
    has: (name) => workflows.has(name),
    list: () => [...workflows.values()],
    describe: () => [...workflows.values()].map(describeWorkflow)
  };
}

/**
 * Create a runner that executes workflows and keeps a bounded run history.
 */
export function createWorkflowRunner({ registry, historyLimit = 100, now = () => Date.now(), idFactory } = {}) {
  if (!registry) {
    throw new TypeError('createWorkflowRunner: a registry is required.');
  }
  const runs = [];
  let counter = 0;
  const makeId = idFactory ?? (() => `run_${now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`);
  const listeners = new Set();

  function emitChange(record) {
    for (const listener of listeners) {
      try {
        listener(record);
      } catch {
        // Listener failures must never break workflow execution.
      }
    }
  }

  async function run(workflowName, input = {}, meta = {}) {
    const workflow = registry.get(workflowName);
    if (!workflow) {
      throw new Error(`runner.run: unknown workflow "${workflowName}".`);
    }

    const startedAt = now();
    const record = {
      id: makeId(),
      workflow: workflow.name,
      trigger: meta.trigger ?? workflow.trigger.type,
      status: RUN_STATUS.RUNNING,
      input,
      output: null,
      error: null,
      startedAt,
      finishedAt: null,
      durationMs: null,
      steps: [],
      logs: []
    };

    runs.unshift(record);
    if (runs.length > historyLimit) {
      runs.length = historyLimit;
    }
    emitChange(record);

    const context = {
      workflow: workflow.name,
      runId: record.id,
      trigger: record.trigger,
      input,
      state: { ...input },
      log: (message) => {
        record.logs.push({ at: now(), message: String(message) });
        emitChange(record);
      }
    };

    for (const step of workflow.steps) {
      const stepStarted = now();
      const stepRecord = {
        name: step.name,
        status: RUN_STATUS.RUNNING,
        output: null,
        error: null,
        startedAt: stepStarted,
        finishedAt: null,
        durationMs: null
      };
      record.steps.push(stepRecord);
      emitChange(record);

      try {
        const patch = await step.run(context);
        if (patch && typeof patch === 'object') {
          context.state = { ...context.state, ...patch };
          stepRecord.output = patch;
        }
        stepRecord.status = RUN_STATUS.SUCCEEDED;
      } catch (error) {
        stepRecord.status = RUN_STATUS.FAILED;
        stepRecord.error = error instanceof Error ? error.message : String(error);
        stepRecord.finishedAt = now();
        stepRecord.durationMs = stepRecord.finishedAt - stepStarted;
        record.status = RUN_STATUS.FAILED;
        record.error = `Step "${step.name}" failed: ${stepRecord.error}`;
        record.finishedAt = now();
        record.durationMs = record.finishedAt - startedAt;
        emitChange(record);
        return record;
      }

      stepRecord.finishedAt = now();
      stepRecord.durationMs = stepRecord.finishedAt - stepStarted;
      emitChange(record);
    }

    record.status = RUN_STATUS.SUCCEEDED;
    record.output = context.state;
    record.finishedAt = now();
    record.durationMs = record.finishedAt - startedAt;
    emitChange(record);
    return record;
  }

  return {
    run,
    getRun: (id) => runs.find((entry) => entry.id === id) ?? null,
    listRuns: () => runs.slice(),
    stats: () => ({
      total: runs.length,
      succeeded: runs.filter((r) => r.status === RUN_STATUS.SUCCEEDED).length,
      failed: runs.filter((r) => r.status === RUN_STATUS.FAILED).length,
      running: runs.filter((r) => r.status === RUN_STATUS.RUNNING).length
    }),
    clear: () => {
      runs.length = 0;
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

/**
 * Wire schedule and event triggers from a registry to a runner. Manual triggers
 * are also supported directly via fireManual().
 */
export function createTriggerManager({ registry, runner }) {
  if (!registry || !runner) {
    throw new TypeError('createTriggerManager: both registry and runner are required.');
  }

  const timers = new Map();
  const eventMap = new Map();

  for (const workflow of registry.list()) {
    if (workflow.trigger.type === 'event') {
      const subscribers = eventMap.get(workflow.trigger.on) ?? [];
      subscribers.push(workflow.name);
      eventMap.set(workflow.trigger.on, subscribers);
    }
  }

  function startSchedules() {
    for (const workflow of registry.list()) {
      if (workflow.trigger.type !== 'schedule' || timers.has(workflow.name)) {
        continue;
      }
      const timer = setInterval(() => {
        runner.run(workflow.name, workflow.trigger.input ?? {}, { trigger: 'schedule' });
      }, workflow.trigger.everyMs);
      timer.unref?.();
      timers.set(workflow.name, timer);
    }
    return [...timers.keys()];
  }

  function stopSchedules() {
    for (const timer of timers.values()) {
      clearInterval(timer);
    }
    timers.clear();
  }

  async function emit(eventName, payload = {}) {
    const subscribers = eventMap.get(eventName) ?? [];
    return Promise.all(subscribers.map((name) => runner.run(name, payload, { trigger: `event:${eventName}` })));
  }

  function fireManual(workflowName, input = {}) {
    return runner.run(workflowName, input, { trigger: 'manual' });
  }

  return {
    startSchedules,
    stopSchedules,
    emit,
    fireManual,
    eventNames: () => [...eventMap.keys()],
    scheduledWorkflows: () => registry.list().filter((w) => w.trigger.type === 'schedule').map((w) => w.name)
  };
}
