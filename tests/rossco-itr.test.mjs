import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lifecycleMap,
  planRelease,
  scopeRelease,
  copyrightJson,
  validatePrototype,
  emitSeo,
  registerProduct,
  DEFAULT_CONFIG
} from '../tools/rossco/src/index.mjs';

test('lifecycle map includes full ITR stages', () => {
  const map = lifecycleMap();
  assert.equal(map.stages.length, 10);
  assert.equal(map.stages[0].id, 'map');
  assert.equal(map.stages.at(-1).id, 'seo');
  assert.ok(map.edges.some((edge) => edge.from === 'register' && edge.to === 'presence'));
});

test('plan and scope expose velocity + boundaries', () => {
  const plan = planRelease();
  assert.equal(plan.velocityTarget.mode, 'infinite');
  const scope = scopeRelease();
  assert.ok(scope.inScope.includes('tools/rossco'));
  assert.ok(scope.deferred.length > 0);
});

test('copyright JSON seals ROSS.CO marks', () => {
  const ip = copyrightJson();
  assert.match(ip.product, /ROSS\.CO/);
  assert.ok(ip.marks.some((mark) => mark.mark === 'Infinite Transfer Rate'));
  assert.equal(ip.spdx, 'MIT');
});

test('validate / seo / register work on repo root', async () => {
  const root = process.cwd();
  const validation = await validatePrototype(root);
  assert.equal(validation.ok, true, JSON.stringify(validation.checks, null, 2));

  const seo = await emitSeo(root);
  assert.ok(seo.artifacts.some((item) => item.endsWith('sitemap.xml')));
  assert.equal(seo.domain, DEFAULT_CONFIG.brand.domain);

  const registered = await registerProduct(root);
  assert.equal(registered.entry.status, 'registered_prototype');
  assert.match(registered.outPath, /rossco-registry\.json$/);
});

test('default config brand is ROSS.CO ITR', () => {
  assert.equal(DEFAULT_CONFIG.brand.name, 'ROSS.CO');
  assert.equal(DEFAULT_CONFIG.transfer.mode, 'infinite');
});
