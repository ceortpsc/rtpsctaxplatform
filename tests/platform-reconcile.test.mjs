import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateMetrics,
  buildAnalyticsFeed,
  reportPipelineThroughput,
  analyticsCenter
} from '../engines/analytics-center/src/index.mjs';
import {
  listTcCodes,
  lookupTcCode,
  enrichMasterfile,
  tagIndicators,
  tcCodeEngine
} from '../engines/tc-code-engine/src/index.mjs';
import { planFill, describeFillJob, pdfFillEngine } from '../engines/pdf-fill-engine/src/index.mjs';
import {
  PLATFORM_SERVICES,
  PLATFORM_ENGINES,
  listPlatformRoutes,
  listPlatformPages,
  resolveServiceEntry,
  platformRegistrySummary
} from '../packages/platform-core/src/registry.mjs';
import { buildRouteRegistry, SERVICE_ENDPOINTS, buildModuleCatalog } from '../services/modules-dashboard/src/catalog.mjs';

test('analytics center aggregates metrics and feed cards', () => {
  const rollup = aggregateMetrics({
    transmissionsQueued: 10,
    transmissionsCompleted: 8,
    refundCasesOpen: 3,
    refundCasesResolved: 7,
    services: [{ ok: true }, { ok: false }]
  });
  assert.equal(analyticsCenter.name, 'analytics-center');
  assert.equal(rollup.throughput.transmissionRate, 0.8);
  assert.equal(rollup.health.unhealthy, 1);
  const feed = buildAnalyticsFeed({
    transmissionsCompleted: 2,
    intelligence: { score: 80, refundStatusCanonical: { state: 'APPROVED' }, guardLevel: { level: 'LOW' } }
  });
  assert.ok(feed.cards.some((card) => card.id === 'intelligence'));
  const throughput = reportPipelineThroughput([
    { name: 'normalize', processed: 9, failed: 1 },
    { name: 'emit', processed: 8, failed: 0 }
  ]);
  assert.equal(throughput.stages.length, 2);
  assert.ok(throughput.overallSuccessRate > 0.8);
});

test('tc code engine catalogs holds and enriches masterfile', () => {
  assert.ok(tcCodeEngine.capabilities.includes('tc-code-catalog'));
  assert.ok(listTcCodes({ hold: true }).some((entry) => entry.code === '570'));
  assert.equal(lookupTcCode('TC 846').ok, true);
  assert.equal(lookupTcCode('999').ok, false);
  const tagged = tagIndicators(['570', '846', '999']);
  assert.deepEqual(tagged.holdSignals, ['570']);
  assert.ok(tagged.unknown.includes('999'));
  const enriched = enrichMasterfile({ id: 'mf-1', taxYear: 2025, tcCodes: ['810', '150'] });
  assert.equal(enriched.refundImpact, 'hold');
  assert.ok(enriched.analyticsTags.includes('refund-freeze'));
});

test('pdf fill engine plans deterministic field maps', () => {
  assert.equal(pdfFillEngine.name, 'pdf-fill-engine');
  const job = describeFillJob({
    template: 'forms/templates/1040.pdf',
    fields: { taxpayerName: 'Jordan Ellis', ssn: '000-00-0000' }
  });
  assert.equal(job.fieldCount, 2);
  assert.ok(job.fieldMap.find((field) => field.name === 'ssn').sensitive);
  const plan = planFill({ fields: { a: 1 } });
  assert.equal(plan.ready, true);
});

test('platform registry lists every service port and route surface', () => {
  const summary = platformRegistrySummary();
  assert.equal(PLATFORM_SERVICES.length, 10);
  assert.equal(PLATFORM_ENGINES.length, 6);
  assert.ok(summary.routeCount > 40);
  assert.ok(listPlatformPages().some((page) => page.port === 3010));
  assert.equal(resolveServiceEntry('irs').port, 8820);
  assert.equal(resolveServiceEntry('ai-workforce').port, 8860);
  const routes = listPlatformRoutes();
  assert.ok(routes.find((r) => r.service === 'analytics-service').routes.includes('GET /api/feed'));
});

test('catalog and route registry include irs, ai workforce, and all engines', () => {
  const catalog = buildModuleCatalog();
  const services = catalog.find((group) => group.category === 'services').modules.map((m) => m.name);
  assert.ok(services.includes('irs-gateway'));
  assert.ok(services.includes('ai-workforce-hub'));
  const engines = catalog.find((group) => group.category === 'engines').modules.map((m) => m.name);
  assert.deepEqual(
    engines.sort(),
    [
      'ai-persona-runtime',
      'analytics-center',
      'pdf-fill-engine',
      'refund-intelligence-engine',
      'refund-optimization-engine',
      'tc-code-engine'
    ].sort()
  );
  const endpoints = SERVICE_ENDPOINTS.map((e) => e.name);
  assert.ok(endpoints.includes('irs-gateway'));
  assert.ok(endpoints.includes('ai-workforce-hub'));
  assert.equal(new Set(SERVICE_ENDPOINTS.map((e) => e.port)).size, SERVICE_ENDPOINTS.length);
  const registry = buildRouteRegistry();
  assert.equal(registry.services.length, 10);
  assert.ok(registry.services.every((s) => Array.isArray(s.routes) && s.routes.length > 0));
});
