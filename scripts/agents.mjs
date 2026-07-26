// Agent orchestrator CLI.
//   node scripts/agents.mjs                         # run all agents (JSON summary)
//   node scripts/agents.mjs docs|--write            # write docs/agents markdown
//   node scripts/agents.mjs list|assignments        # list agents + assignments
//   node scripts/agents.mjs assign <id> <agent>     # reassign a task to an agent
//   node scripts/agents.mjs run [required|all|<id>|<agent>]
//   node scripts/agents.mjs trigger <manual|event|schedule> [json]
//   node scripts/agents.mjs workflow [list|run|emit] ...
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runPlatformAgents, createPlatformAgentRegistry } from '../packages/agent-core/src/roster.mjs';
import { REQUIRED_ASSIGNMENTS } from '../packages/agent-core/src/assignments.mjs';
import { createPlatformAssignmentBoard, runRequiredAssignments } from '../packages/agent-core/src/dispatch.mjs';
import { agentAssignmentWorkflows } from '../packages/agent-core/src/assignment-workflows.mjs';
import {
  createTriggerManager,
  createWorkflowRegistry,
  createWorkflowRunner,
  describeWorkflow
} from '../packages/workflow-engine/src/index.mjs';

const args = process.argv.slice(2);
const command = args[0] ?? 'run-all';

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

function createAgentWorkflowRuntime() {
  const registry = createWorkflowRegistry([...agentAssignmentWorkflows]);
  const runner = createWorkflowRunner({ registry, historyLimit: 100 });
  const triggers = createTriggerManager({ registry, runner });
  return { registry, runner, triggers };
}

async function writeDocs() {
  const { reports, documents } = await runPlatformAgents();
  for (const doc of documents) {
    await mkdir(path.dirname(doc.path), { recursive: true });
    const contents = doc.markdown.endsWith('\n') ? doc.markdown : `${doc.markdown}\n`;
    await writeFile(doc.path, contents);
    console.log(`wrote ${doc.path}`);
  }
  console.log(`\nGenerated ${documents.length} markdown document(s).`);
  return reports;
}

async function runAllSummary() {
  const { reports } = await runPlatformAgents();
  print(reports.map((report) => ({ agent: report.agent, status: report.status, summary: report.summary })));
}

async function listBoard() {
  const board = createPlatformAssignmentBoard();
  const registry = createPlatformAgentRegistry();
  print({
    team: registry.describe(),
    requiredAssignments: REQUIRED_ASSIGNMENTS.map((a) => ({
      id: a.id,
      title: a.title,
      agent: a.agent,
      trigger: a.trigger,
      priority: a.priority
    })),
    board: board.describe()
  });
}

async function assignTask(assignmentId, agentName) {
  if (!assignmentId || !agentName) {
    console.error('Usage: agents assign <assignment-id> <agent-name>');
    process.exitCode = 1;
    return;
  }
  const board = createPlatformAssignmentBoard();
  print({ assigned: board.assign(assignmentId, agentName), board: board.describe() });
}

async function runAssignments(target) {
  const board = createPlatformAssignmentBoard();
  let input = { mode: 'required' };
  if (!target || target === 'required') input = { mode: 'required' };
  else if (target === 'all') input = { mode: 'all' };
  else if (board.get(target)) input = { assignmentId: target };
  else if (board.agents().some((a) => a.name === target)) input = { agent: target };
  else {
    console.error(
      `Unknown target "${target}". Use: required | all | <assignment-id> | <agent-name>\n` +
        `Assignments: ${board.list().map((a) => a.id).join(', ')}\n` +
        `Agents: ${board.agents().map((a) => a.name).join(', ')}`
    );
    process.exitCode = 1;
    return;
  }
  const batch = await board.run(input, { trigger: 'manual' });
  print({ input, batch, board: board.describe() });
  process.exitCode = batch.failed > 0 ? 1 : 0;
}

async function fireBoardTrigger(triggerType, rawPayload) {
  if (!triggerType || !['manual', 'event', 'schedule'].includes(triggerType)) {
    console.error('Usage: agents trigger <manual|event|schedule> [json-payload]');
    process.exitCode = 1;
    return;
  }
  let payload = {};
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      console.error('Payload must be valid JSON.');
      process.exitCode = 1;
      return;
    }
  }
  const board = createPlatformAssignmentBoard();
  const batch = await board.fireTrigger(triggerType, payload);
  print({ triggerType, payload, batch });
  process.exitCode = batch.failed > 0 ? 1 : 0;
}

async function workflowCommand(rest) {
  const [sub = 'list', target, rawPayload] = rest;
  const { registry, triggers } = createAgentWorkflowRuntime();

  if (sub === 'list') {
    print({ workflows: registry.list().map(describeWorkflow) });
    return;
  }

  let payload = {};
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      console.error('Payload must be valid JSON.');
      process.exitCode = 1;
      return;
    }
  }

  if (sub === 'run') {
    if (!target || !registry.has(target)) {
      console.error(
        `Unknown agent workflow "${target}". Available: ${registry.list().map((w) => w.name).join(', ')}`
      );
      process.exitCode = 1;
      return;
    }
    const record = await triggers.fireManual(target, payload);
    print(record);
    process.exitCode = record.status === 'failed' ? 1 : 0;
    return;
  }

  if (sub === 'emit') {
    if (!target) {
      console.error('Usage: agents workflow emit <event-name> [json-payload]');
      process.exitCode = 1;
      return;
    }
    const records = await triggers.emit(target, payload);
    print({ event: target, triggered: records.length, runs: records });
    process.exitCode = records.some((r) => r.status === 'failed') ? 1 : 0;
    return;
  }

  console.error('Usage: agents workflow [list|run|emit] ...');
  process.exitCode = 1;
}

async function main() {
  switch (command) {
    case 'run-all':
      await runAllSummary();
      return;
    case 'list':
    case 'assignments':
      await listBoard();
      return;
    case 'assign':
      await assignTask(args[1], args[2]);
      return;
    case 'run':
      await runAssignments(args[1]);
      return;
    case 'required': {
      const result = await runRequiredAssignments();
      print(result);
      process.exitCode = result.batch.failed > 0 ? 1 : 0;
      return;
    }
    case 'trigger':
      await fireBoardTrigger(args[1], args[2]);
      return;
    case 'workflow':
    case 'workflows':
      await workflowCommand(args.slice(1));
      return;
    case 'docs':
    case '--write':
      await writeDocs();
      return;
    case 'help':
    case '--help':
    case '-h':
      console.log(`RTPSC agents — deployment-assist & development team

Usage:
  ./rtpsc agents                         Run all analysis agents (JSON summary)
  ./rtpsc agents docs                    Write docs/agents/*.md
  ./rtpsc agents list                    List agents + required assignments
  ./rtpsc agents assign <id> <agent>     Reassign a task to an agent
  ./rtpsc agents run [required|all|id|agent]
  ./rtpsc agents required                Run every required assignment
  ./rtpsc agents trigger <manual|event|schedule> [json]
  ./rtpsc agents workflow list|run|emit  Agent-assignment workflows / triggers
`);
      return;
    default:
      console.error(`Unknown agents command "${command}". Try: ./rtpsc agents help`);
      process.exitCode = 1;
  }
}

await main();
