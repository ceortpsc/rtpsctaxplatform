import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModuleCatalog, catalogSummary, SERVICE_ENDPOINTS } from '../services/modules-dashboard/src/catalog.mjs';

test('module catalog exposes every module category', () => {
  const catalog = buildModuleCatalog();
  const categories = catalog.map((group) => group.category);
  assert.deepEqual(categories, ['packages', 'services', 'workers', 'pipelines', 'engines', 'workflows']);
});

test('catalog summary totals match the catalog contents', () => {
  const catalog = buildModuleCatalog();
  const summary = catalogSummary(catalog);
  const manualTotal = catalog.reduce((sum, group) => sum + group.modules.length, 0);
  assert.equal(summary.totalModules, manualTotal);
  assert.ok(summary.totalModules >= 20, 'expected a rich catalog of modules');
});

test('workflow modules are listed as background modules with trigger tags', () => {
  const workflows = buildModuleCatalog().find((group) => group.category === 'workflows');
  const names = workflows.modules.map((m) => m.name);
  assert.deepEqual(names, [
    'refund-status-update',
    'transcript-intake',
    'transmission-cycle',
    'agent-assignment-dispatch',
    'agent-task-requested',
    'agent-assignment-cycle',
    'production-activation-dispatch',
    'production-activation-requested',
    'production-activation-cycle'
  ]);
  const refund = workflows.modules.find((m) => m.name === 'refund-status-update');
  assert.ok(refund.tags.some((tag) => tag.startsWith('event:')));
  const agentEvent = workflows.modules.find((m) => m.name === 'agent-task-requested');
  assert.ok(agentEvent.tags.some((tag) => tag === 'event:agent.task.requested'));
});

test('SERVICE_ENDPOINTS lists every HTTP service with a distinct port', () => {
  const names = SERVICE_ENDPOINTS.map((e) => e.name);
  assert.ok(names.includes('api-gateway'));
  assert.ok(names.includes('modules-dashboard'));
  assert.ok(names.includes('invoice-service'));
  assert.ok(names.includes('pos-crm-service'));
  assert.ok(names.includes('irs-gateway'));
  assert.ok(names.includes('ai-workforce-hub'));
  assert.ok(names.includes('web-portal'));
  assert.ok(names.includes('staff-portal'));
  const ports = SERVICE_ENDPOINTS.map((e) => e.port);
  assert.equal(new Set(ports).size, ports.length, 'ports must be unique');
  assert.ok(SERVICE_ENDPOINTS.find((e) => e.name === 'api-gateway').port === 3000);
  assert.equal(SERVICE_ENDPOINTS.find((e) => e.name === 'invoice-service').port, 3005);
  assert.equal(SERVICE_ENDPOINTS.find((e) => e.name === 'pos-crm-service').port, 3006);
  assert.equal(SERVICE_ENDPOINTS.find((e) => e.name === 'irs-gateway').port, 8820);
  assert.equal(SERVICE_ENDPOINTS.find((e) => e.name === 'ai-workforce-hub').port, 8860);
  assert.equal(SERVICE_ENDPOINTS.find((e) => e.name === 'web-portal').port, 3011);
  assert.equal(SERVICE_ENDPOINTS.find((e) => e.name === 'staff-portal').port, 3012);
});

test('every catalog entry has name, summary and tags', () => {
  for (const group of buildModuleCatalog()) {
    for (const module of group.modules) {
      assert.equal(typeof module.name, 'string');
      assert.equal(typeof module.summary, 'string');
      assert.ok(Array.isArray(module.tags));
    }
  }
});

test('catalog includes canvas-core for Cursor Canvas creation', () => {
  const packages = buildModuleCatalog().find((group) => group.category === 'packages');
  const canvas = packages.modules.find((m) => m.name === '@rtp/canvas-core');
  assert.ok(canvas, 'expected @rtp/canvas-core in packages category');
  assert.ok(canvas.tags.includes('canvas'));
  assert.deepEqual(canvas.detail.kinds, ['platform', 'compliance', 'agents', 'modules']);
});
