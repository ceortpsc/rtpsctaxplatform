import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModuleCatalog, catalogSummary } from '../services/modules-dashboard/src/catalog.mjs';

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
  assert.deepEqual(names, ['refund-status-update', 'transcript-intake', 'transmission-cycle']);
  const refund = workflows.modules.find((m) => m.name === 'refund-status-update');
  assert.ok(refund.tags.some((tag) => tag.startsWith('event:')));
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
