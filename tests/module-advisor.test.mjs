import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInsights, answerQuery, buildDependencyGraph } from '../packages/module-advisor/src/index.mjs';
import { buildModuleCatalog } from '../services/modules-dashboard/src/catalog.mjs';

const catalog = buildModuleCatalog();

test('buildInsights summarizes triggers, dependencies, and recommendations', () => {
  const insights = buildInsights(catalog);
  assert.equal(insights.totalModules, catalog.reduce((n, g) => n + g.modules.length, 0));
  assert.equal(insights.triggerCounts.event + insights.triggerCounts.schedule + insights.triggerCounts.manual, 3);
  assert.equal(insights.backgroundWorkflows, insights.triggerCounts.event + insights.triggerCounts.schedule);
  assert.ok(insights.recommendations.length > 0);
  assert.ok(insights.recommendations.some((r) => /secure tunnel/i.test(r.message)), 'flags secure-tunnel stub');
});

test('answerQuery handles the event-driven trigger intent', () => {
  const result = answerQuery(catalog, 'which workflows are event-driven?');
  assert.equal(result.intent, 'trigger:event');
  assert.ok(result.matches.some((m) => m.name === 'refund-status-update'));
});

test('answerQuery handles counting intent', () => {
  const result = answerQuery(catalog, 'how many modules are there?');
  assert.equal(result.intent, 'count');
  assert.match(result.answer, /modules total/);
});

test('answerQuery resolves dependents of a named service', () => {
  const result = answerQuery(catalog, 'what depends on refund-status-service?');
  assert.equal(result.intent, 'dependents');
  assert.ok(result.matches.some((m) => m.name === 'refund-status-service'));
});

test('answerQuery falls back to keyword search', () => {
  const result = answerQuery(catalog, 'analytics');
  assert.ok(['search', 'dependents', 'dependencies'].includes(result.intent));
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.some((m) => m.name.includes('analytics')));
});

test('answerQuery returns guidance for empty queries', () => {
  const result = answerQuery(catalog, '');
  assert.equal(result.intent, 'empty');
  assert.ok(result.suggestions.length > 0);
});

test('buildDependencyGraph produces nodes and typed edges', () => {
  const graph = buildDependencyGraph(catalog);
  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.edges.some((e) => e.type === 'depends-on'));
  assert.ok(graph.edges.some((e) => e.type === 'drives' && e.from === 'workflow-runner'));
});
