// Agent assignment board: maps required platform tasks to development-team
// agents, tracks assignment state, and executes assigned agents on demand or
// via trigger-shaped requests (manual | event | schedule).
//
// Dependency injection keeps this module free of import cycles with the
// workflow-runner registry (which later registers agent-assignment workflows).

export const ASSIGNMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed'
});

export const ASSIGNMENT_TRIGGER_TYPES = Object.freeze(['manual', 'event', 'schedule']);

/**
 * Define a required (or ad-hoc) agent assignment.
 * @param {{
 *   id: string,
 *   title: string,
 *   description?: string,
 *   agent: string,
 *   trigger?: { type: string, on?: string, everyMs?: number },
 *   priority?: number,
 *   required?: boolean,
 *   tags?: string[]
 * }} spec
 */
export function defineAssignment({
  id,
  title,
  description = '',
  agent,
  trigger = { type: 'manual' },
  priority = 3,
  required = true,
  tags = []
}) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('defineAssignment: "id" is required.');
  }
  if (typeof agent !== 'string' || agent.trim() === '') {
    throw new TypeError(`defineAssignment: assignment "${id}" requires an agent name.`);
  }
  if (typeof title !== 'string' || title.trim() === '') {
    throw new TypeError(`defineAssignment: assignment "${id}" requires a title.`);
  }
  if (!ASSIGNMENT_TRIGGER_TYPES.includes(trigger?.type)) {
    throw new TypeError(
      `defineAssignment: assignment "${id}" trigger.type must be one of ${ASSIGNMENT_TRIGGER_TYPES.join(', ')}.`
    );
  }
  if (trigger.type === 'event' && (typeof trigger.on !== 'string' || trigger.on.trim() === '')) {
    throw new TypeError(`defineAssignment: event assignment "${id}" requires trigger.on.`);
  }
  if (trigger.type === 'schedule' && !(Number(trigger.everyMs) > 0)) {
    throw new TypeError(`defineAssignment: scheduled assignment "${id}" requires trigger.everyMs.`);
  }

  return Object.freeze({
    kind: 'assignment',
    id,
    title,
    description,
    agent,
    trigger: Object.freeze({ ...trigger }),
    priority,
    required: Boolean(required),
    tags: Object.freeze([...tags])
  });
}

/** Default required tasks assigned to the deployment-assist development team. */
export const REQUIRED_ASSIGNMENTS = Object.freeze([
  defineAssignment({
    id: 'plan-delivery',
    title: 'Plan phased delivery',
    description: 'Produce the phased delivery plan, milestones, and exit criteria.',
    agent: 'planning-agent',
    trigger: { type: 'manual' },
    priority: 1,
    tags: ['planning', 'required']
  }),
  defineAssignment({
    id: 'scope-inventory',
    title: 'Scope inventory & complexity',
    description: 'Inventory modules, score complexity, and publish scope boundaries.',
    agent: 'scoping-agent',
    trigger: { type: 'manual' },
    priority: 1,
    tags: ['scoping', 'required']
  }),
  defineAssignment({
    id: 'validate-platform',
    title: 'Validate & verify platform invariants',
    description: 'Run catalog/workflow/environment invariant checks.',
    agent: 'testing-agent',
    trigger: { type: 'event', on: 'agent.task.requested' },
    priority: 1,
    tags: ['testing', 'validation', 'required']
  }),
  defineAssignment({
    id: 'map-dependencies',
    title: 'Map dependencies & enhancements',
    description: 'Build the dependency graph and enhancement recommendations.',
    agent: 'mapping-agent',
    trigger: { type: 'manual' },
    priority: 2,
    tags: ['mapping', 'required']
  }),
  defineAssignment({
    id: 'stage-rollout',
    title: 'Stage promotion pipeline',
    description: 'Define staged rollout, promotion path, and release gates.',
    agent: 'staging-agent',
    trigger: { type: 'manual' },
    priority: 2,
    tags: ['staging', 'required']
  }),
  defineAssignment({
    id: 'assess-environment',
    title: 'Assess environment & safeguards',
    description: 'Inspect environment protection, safeguards, and findings.',
    agent: 'assessment-agent',
    trigger: { type: 'event', on: 'agent.task.requested' },
    priority: 2,
    tags: ['assessment', 'required']
  }),
  defineAssignment({
    id: 'seo-ownership-prevalidate',
    title: 'SEO ownership & Search Console prevalidation',
    description: 'Assert ROSS.CO ownership, generate SEO assets, and prevalidate Search Console / IndexNow readiness.',
    agent: 'seo-ownership-agent',
    trigger: { type: 'manual' },
    priority: 2,
    tags: ['seo', 'ownership', 'search-console', 'required']
  }),
  defineAssignment({
    id: 'generate-docs',
    title: 'Generate agent documentation',
    description: 'Render analysis reports into docs/agents markdown.',
    agent: 'markdown-agent',
    trigger: { type: 'manual' },
    priority: 3,
    tags: ['documentation', 'required']
  }),
  defineAssignment({
    id: 'agent-cycle-health',
    title: 'Agent assignment cycle health',
    description: 'Periodic health check that re-runs the testing agent on schedule.',
    agent: 'testing-agent',
    trigger: { type: 'schedule', everyMs: 120000 },
    priority: 4,
    required: true,
    tags: ['health', 'cycle']
  })
]);

/**
 * Create an in-memory assignment board.
 * @param {{
 *   agents: Array<{ name: string, title?: string, run: Function }>,
 *   assignments?: object[],
 *   buildContext: () => object,
 *   runAgent: (agent: object, context: object) => Promise<object>,
 *   now?: () => number
 * }} options
 */
export function createAssignmentBoard({
  agents = [],
  assignments = REQUIRED_ASSIGNMENTS,
  buildContext,
  runAgent,
  now = () => Date.now()
} = {}) {
  if (typeof buildContext !== 'function') {
    throw new TypeError('createAssignmentBoard: buildContext() is required.');
  }
  if (typeof runAgent !== 'function') {
    throw new TypeError('createAssignmentBoard: runAgent() is required.');
  }

  const agentMap = new Map(agents.map((agent) => [agent.name, agent]));
  const board = new Map();
  const history = [];

  function seed(assignment) {
    if (!assignment || assignment.kind !== 'assignment') {
      throw new TypeError('board: expected an assignment from defineAssignment().');
    }
    if (!agentMap.has(assignment.agent)) {
      throw new Error(`board: unknown agent "${assignment.agent}" for assignment "${assignment.id}".`);
    }
    if (board.has(assignment.id)) {
      throw new Error(`board: assignment "${assignment.id}" already registered.`);
    }
    const record = {
      ...assignment,
      status: ASSIGNMENT_STATUSES.ASSIGNED,
      assignedAt: new Date(now()).toISOString(),
      lastRunId: null,
      lastRunAt: null,
      lastError: null,
      runCount: 0
    };
    board.set(assignment.id, record);
    return describeAssignment(record);
  }

  assignments.forEach(seed);

  function describeAssignment(record) {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      agent: record.agent,
      trigger: { ...record.trigger },
      priority: record.priority,
      required: record.required,
      tags: [...record.tags],
      status: record.status,
      assignedAt: record.assignedAt,
      lastRunId: record.lastRunId,
      lastRunAt: record.lastRunAt,
      lastError: record.lastError,
      runCount: record.runCount
    };
  }

  function list({ requiredOnly = false, agent = null, status = null } = {}) {
    return [...board.values()]
      .filter((entry) => (requiredOnly ? entry.required : true))
      .filter((entry) => (agent ? entry.agent === agent : true))
      .filter((entry) => (status ? entry.status === status : true))
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
      .map(describeAssignment);
  }

  function get(id) {
    const record = board.get(id);
    return record ? describeAssignment(record) : null;
  }

  function assign(id, agentName) {
    const record = board.get(id);
    if (!record) throw new Error(`board.assign: unknown assignment "${id}".`);
    if (!agentMap.has(agentName)) throw new Error(`board.assign: unknown agent "${agentName}".`);
    record.agent = agentName;
    record.status = ASSIGNMENT_STATUSES.ASSIGNED;
    record.assignedAt = new Date(now()).toISOString();
    record.lastError = null;
    return describeAssignment(record);
  }

  function register(assignment) {
    return seed(assignment);
  }

  function matchTrigger(triggerType, eventName = null) {
    return [...board.values()].filter((entry) => {
      if (entry.trigger.type !== triggerType) return false;
      if (triggerType === 'event') return entry.trigger.on === eventName;
      return true;
    });
  }

  function resolveTargets(input = {}) {
    if (input.assignmentId) {
      const one = board.get(input.assignmentId);
      if (!one) throw new Error(`board: unknown assignmentId "${input.assignmentId}".`);
      return [one];
    }
    if (input.agent) {
      const matched = [...board.values()].filter((entry) => entry.agent === input.agent);
      if (matched.length === 0) throw new Error(`board: no assignments for agent "${input.agent}".`);
      return matched;
    }
    if (input.mode === 'all') return [...board.values()];
    // Default: required assignments only.
    return [...board.values()].filter((entry) => entry.required);
  }

  async function runOne(record, input = {}, meta = {}) {
    const agent = agentMap.get(record.agent);
    const startedAt = now();
    const runId = `asg_${startedAt.toString(36)}_${record.id}`;
    record.status = ASSIGNMENT_STATUSES.RUNNING;
    record.lastRunId = runId;
    record.lastRunAt = new Date(startedAt).toISOString();
    record.runCount += 1;

    try {
      const baseContext = buildContext();
      const context = {
        ...baseContext,
        assignment: describeAssignment(record),
        trigger: meta.trigger ?? record.trigger.type,
        input
      };

      // markdown-agent expects prior analysis reports when available.
      if (record.agent === 'markdown-agent' && !context.reports) {
        const analysis = [...agentMap.values()].filter((a) => a.name !== 'markdown-agent');
        const reports = [];
        for (const peer of analysis) {
          reports.push(await runAgent(peer, baseContext));
        }
        context.reports = reports;
      }

      const report = await runAgent(agent, context);
      const ok = report.status === 'ok';
      record.status = ok ? ASSIGNMENT_STATUSES.SUCCEEDED : ASSIGNMENT_STATUSES.FAILED;
      record.lastError = ok ? null : report.error ?? 'agent reported failure';

      const result = {
        runId,
        assignmentId: record.id,
        agent: record.agent,
        trigger: meta.trigger ?? record.trigger.type,
        status: record.status,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(now()).toISOString(),
        durationMs: now() - startedAt,
        report: {
          agent: report.agent,
          status: report.status,
          summary: report.summary,
          error: report.error ?? null,
          sectionCount: report.sections?.length ?? 0
        }
      };
      history.unshift(result);
      if (history.length > 200) history.length = 200;
      return result;
    } catch (error) {
      record.status = ASSIGNMENT_STATUSES.FAILED;
      record.lastError = error instanceof Error ? error.message : String(error);
      const result = {
        runId,
        assignmentId: record.id,
        agent: record.agent,
        trigger: meta.trigger ?? record.trigger.type,
        status: ASSIGNMENT_STATUSES.FAILED,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(now()).toISOString(),
        durationMs: now() - startedAt,
        error: record.lastError,
        report: null
      };
      history.unshift(result);
      if (history.length > 200) history.length = 200;
      return result;
    }
  }

  async function run(input = {}, meta = {}) {
    const targets = resolveTargets(input);
    const results = [];
    for (const record of targets.sort((a, b) => a.priority - b.priority)) {
      // Event triggers only execute assignments that subscribe to that event,
      // unless a concrete assignmentId/agent was requested.
      if (meta.eventName && !input.assignmentId && !input.agent) {
        if (record.trigger.type !== 'event' || record.trigger.on !== meta.eventName) {
          continue;
        }
      }
      if (meta.triggerType === 'schedule' && !input.assignmentId && !input.agent) {
        if (record.trigger.type !== 'schedule') continue;
      }
      results.push(await runOne(record, input, meta));
    }
    return {
      trigger: meta.trigger ?? 'manual',
      requested: input,
      executed: results.length,
      succeeded: results.filter((r) => r.status === ASSIGNMENT_STATUSES.SUCCEEDED).length,
      failed: results.filter((r) => r.status === ASSIGNMENT_STATUSES.FAILED).length,
      results
    };
  }

  async function fireTrigger(triggerType, payload = {}) {
    if (triggerType === 'event') {
      const eventName = payload.event ?? payload.on ?? 'agent.task.requested';
      return run(payload, { trigger: `event:${eventName}`, eventName, triggerType: 'event' });
    }
    if (triggerType === 'schedule') {
      return run(payload, { trigger: 'schedule', triggerType: 'schedule' });
    }
    return run(payload, { trigger: 'manual', triggerType: 'manual' });
  }

  return {
    list,
    get,
    assign,
    register,
    run,
    fireTrigger,
    matchTrigger,
    history: () => history.slice(),
    agents: () =>
      [...agentMap.values()].map((agent) => ({
        name: agent.name,
        title: agent.title,
        assignments: list({ agent: agent.name }).map((a) => a.id)
      })),
    describe: () => ({
      assignments: list(),
      agents: [...agentMap.keys()],
      requiredCount: list({ requiredOnly: true }).length,
      historyCount: history.length
    })
  };
}
