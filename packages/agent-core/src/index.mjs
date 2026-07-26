// Agent core: shared primitives for the RTPSC platform agent suite.
//
// An "agent" is a dependency-free analyzer that receives a platform context
// (module catalog, workflows, environment protection) and returns a structured,
// JSON-serializable report composed of uniform `sections`. The markdown engine
// renders those sections into documentation, so every agent stays consistent.

import { PLATFORM_IDENTITY, evaluateEnvironmentProtection } from '../../platform-core/src/index.mjs';
import { describeWorkflow } from '../../workflow-engine/src/index.mjs';
import { buildModuleCatalog, catalogSummary } from '../../../services/modules-dashboard/src/catalog.mjs';
import { platformWorkflows } from '../../../workers/workflow-runner/src/registry.mjs';

// The RTPSC deployment-assist & development team. These agents are developer /
// deployment tooling (a "virtual team"), not a runtime subsystem of the product.
export const DEVELOPMENT_TEAM = Object.freeze([
  { role: 'planning-agent', title: 'Planning', focus: 'phased delivery plan, milestones & exit criteria' },
  { role: 'scoping-agent', title: 'Scoping', focus: 'inventory, complexity index & scope boundaries' },
  { role: 'testing-agent', title: 'Testing / Validation / Verification', focus: 'invariants, validations & verifications' },
  { role: 'mapping-agent', title: 'Mapping & Enhancement', focus: 'dependency map & enhancement recommendations' },
  { role: 'staging-agent', title: 'Staging', focus: 'staged rollout, promotion & gates' },
  { role: 'assessment-agent', title: 'Environmental Assessment & Inspection', focus: 'environment, safeguards & findings' },
  { role: 'markdown-agent', title: 'Markdown Generation Engine', focus: 'documentation generation' }
]);

/** Define an agent. `run(context)` should return { summary, sections, data }. */
export function defineAgent({ name, title, description = '', capabilities = [], run }) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('defineAgent: "name" is required.');
  }
  if (typeof run !== 'function') {
    throw new TypeError(`defineAgent: agent "${name}" requires a run(context) function.`);
  }
  return Object.freeze({ kind: 'agent', name, title: title ?? name, description, capabilities: Object.freeze([...capabilities]), run });
}

/** Registry of agents keyed by unique name. */
export function createAgentRegistry(initialAgents = []) {
  const agents = new Map();
  const register = (agent) => {
    if (!agent || agent.kind !== 'agent') throw new TypeError('registry.register: expected an agent.');
    if (agents.has(agent.name)) throw new Error(`registry.register: agent "${agent.name}" already registered.`);
    agents.set(agent.name, agent);
    return agent;
  };
  initialAgents.forEach(register);
  return {
    register,
    get: (name) => agents.get(name) ?? null,
    has: (name) => agents.has(name),
    list: () => [...agents.values()],
    describe: () => [...agents.values()].map((a) => ({ name: a.name, title: a.title, description: a.description, capabilities: [...a.capabilities] }))
  };
}

/** Execute one agent, wrapping its report with status metadata. */
export async function runAgent(agent, context) {
  const startedAt = Date.now();
  try {
    const report = await agent.run(context);
    return {
      agent: agent.name,
      title: agent.title,
      status: 'ok',
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary: report?.summary ?? '',
      sections: report?.sections ?? [],
      data: report?.data ?? {}
    };
  } catch (error) {
    return {
      agent: agent.name,
      title: agent.title,
      status: 'error',
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      sections: [],
      data: {}
    };
  }
}

/** Run many agents sequentially against the same context. */
export async function runAgents(agents, context) {
  const reports = [];
  for (const agent of agents) reports.push(await runAgent(agent, context));
  return reports;
}

/** Build the shared context every agent analyzes (platform introspection). */
export function buildAgentContext() {
  const catalog = buildModuleCatalog();
  return {
    identity: PLATFORM_IDENTITY,
    generatedAt: new Date().toISOString(),
    catalog,
    summary: catalogSummary(catalog),
    workflows: platformWorkflows.map(describeWorkflow),
    environment: evaluateEnvironmentProtection(),
    team: DEVELOPMENT_TEAM
  };
}

// Assignment board primitives (required tasks → agents → triggers).
export {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TRIGGER_TYPES,
  REQUIRED_ASSIGNMENTS,
  defineAssignment,
  createAssignmentBoard
} from './assignments.mjs';

/* =============================================================================
   Markdown building blocks (used by the markdown-generation engine agent)
   ========================================================================== */
export const md = {
  h1: (text) => `# ${text}\n`,
  h2: (text) => `## ${text}\n`,
  h3: (text) => `### ${text}\n`,
  p: (text) => `${text}\n`,
  bullets: (items) => items.map((item) => `- ${item}`).join('\n') + '\n',
  ordered: (items) => items.map((item, index) => `${index + 1}. ${item}`).join('\n') + '\n',
  code: (text, lang = '') => '```' + lang + '\n' + text + '\n```\n',
  table: (columns, rows) => {
    const header = `| ${columns.join(' | ')} |`;
    const divider = `| ${columns.map(() => '---').join(' | ')} |`;
    const body = rows.map((row) => `| ${row.map((cell) => String(cell)).join(' | ')} |`).join('\n');
    return `${header}\n${divider}\n${body}\n`;
  }
};

/** Render an array of uniform sections into a markdown string. */
export function renderSections(sections = []) {
  const parts = [];
  for (const section of sections) {
    if (section.heading) parts.push(md.h2(section.heading));
    if (section.body) parts.push(md.p(section.body));
    if (section.bullets?.length) parts.push(md.bullets(section.bullets));
    if (section.ordered?.length) parts.push(md.ordered(section.ordered));
    if (section.table) parts.push(md.table(section.table.columns, section.table.rows));
    if (section.code) parts.push(md.code(section.code.text, section.code.lang ?? ''));
  }
  return parts.join('\n');
}

/** Render a full agent report to a markdown document. */
export function renderReportDocument(report) {
  const header = [
    md.h1(`${report.title}`),
    md.p(`_${PLATFORM_IDENTITY.company} — ${PLATFORM_IDENTITY.application}_`),
    md.p(report.summary || ''),
    md.p(`> Generated by \`${report.agent}\` at ${report.generatedAt}.`)
  ].join('\n');
  return `${header}\n${renderSections(report.sections)}`;
}
