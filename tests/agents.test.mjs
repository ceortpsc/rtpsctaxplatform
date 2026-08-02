import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentContext, runAgent, DEVELOPMENT_TEAM } from '../packages/agent-core/src/index.mjs';
import { runPlatformAgents, platformAgents, analysisAgents } from '../packages/agent-core/src/roster.mjs';
import { planningAgent } from '../agents/planning-agent/src/index.mjs';
import { scopingAgent } from '../agents/scoping-agent/src/index.mjs';
import { testingAgent } from '../agents/testing-agent/src/index.mjs';
import { mappingAgent } from '../agents/mapping-agent/src/index.mjs';
import { stagingAgent } from '../agents/staging-agent/src/index.mjs';
import { assessmentAgent } from '../agents/assessment-agent/src/index.mjs';
import { seoOwnershipAgent } from '../agents/seo-ownership-agent/src/index.mjs';
import { markdownAgent } from '../agents/markdown-agent/src/index.mjs';

test('development team roster has all eight roles', () => {
  assert.equal(DEVELOPMENT_TEAM.length, 8);
  assert.equal(platformAgents.length, 8);
  assert.equal(analysisAgents.length, 7);
});

test('every agent produces a structured report with sections', async () => {
  const context = buildAgentContext();
  for (const agent of [
    planningAgent,
    scopingAgent,
    testingAgent,
    mappingAgent,
    stagingAgent,
    assessmentAgent,
    seoOwnershipAgent
  ]) {
    const report = await runAgent(agent, context);
    assert.equal(report.status, 'ok', `${agent.name} should run cleanly`);
    assert.ok(report.sections.length > 0, `${agent.name} should emit sections`);
    assert.ok(typeof report.summary === 'string' && report.summary.length > 0);
  }
});

test('testing agent validates the real catalog and passes its own checks', async () => {
  const context = buildAgentContext();
  const report = await runAgent(testingAgent, context);
  assert.ok(report.data.total > 0);
  assert.equal(report.data.failed, 0, 'platform should pass all validations/verifications');
});

test('planning agent yields five phases and milestones', async () => {
  const report = await runAgent(planningAgent, buildAgentContext());
  assert.equal(report.data.phases.length, 5);
  assert.equal(report.data.milestones.length, 5);
});

test('markdown engine generates a document per report plus an index', async () => {
  const { reports, documents } = await runPlatformAgents();
  assert.equal(reports.length, 8);
  // one index + one per analysis report (6)
  assert.equal(documents.length, analysisAgents.length + 1);
  assert.ok(documents.some((d) => d.path === 'docs/agents/README.md'));
  assert.ok(documents.every((d) => typeof d.markdown === 'string' && d.markdown.length > 0));
});

test('markdown agent renders team framing, not a subsystem', async () => {
  const context = buildAgentContext();
  const report = await runAgent(markdownAgent, { ...context, reports: [] });
  const index = report.data.documents.find((d) => d.path === 'docs/agents/README.md');
  assert.match(index.markdown, /Deployment Assist & Development Team/);
});
