import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSemver, satisfies, maxSatisfying } from '../src/lib/semver.mjs';
import { planChunkRanges, assertCoverage, transferFile } from '../src/lib/transfer.mjs';
import { resolveDependencies } from '../src/lib/resolver.mjs';
import { createMcpServer } from '../src/server/mcp-lite.mjs';
import { createRegistry } from '../src/server/registry.mjs';
import {
  loadOwnershipConfig,
  ownershipPlan,
  validateOwnershipConfig
} from '../src/seo/ownership.mjs';
import { generateSeoAssets } from '../src/seo/generate.mjs';
import { prevalidateOwnership } from '../src/seo/prevalidate.mjs';
import { planTasks, buildGraph } from '../src/task/engine.mjs';
import { doctor } from '../src/policy/doctor.mjs';
import { policyCheck } from '../src/policy/check.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('semver comparison and ranges are deterministic', () => {
  assert.ok(compareSemver('1.2.0', '1.10.0') < 0);
  assert.equal(satisfies('1.2.3', '^1.0.0'), true);
  assert.equal(satisfies('2.0.0', '^1.0.0'), false);
  assert.equal(maxSatisfying(['1.0.0', '1.4.0', '2.0.0'], '^1.0.0'), '1.4.0');
});

test('chunk ranges cover the file without gaps or overlaps', () => {
  const ranges = planChunkRanges(2500, 1000);
  assert.equal(ranges.length, 3);
  assertCoverage(ranges, 2500);
  assert.deepEqual(
    ranges.map((r) => r.length),
    [1000, 1000, 500]
  );
});

test('transfer verifies SHA-256 integrity', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ross-xfer-'));
  try {
    const source = path.join(dir, 'source.bin');
    const dest = path.join(dir, 'dest.bin');
    await writeFile(source, Buffer.alloc(3500, 7));
    const report = await transferFile(source, dest, { chunkSize: 1024, concurrency: 2 });
    assert.match(report.digest, /^sha256:[a-f0-9]{64}$/);
    const a = await readFile(source);
    const b = await readFile(dest);
    assert.deepEqual(a, b);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolver builds deterministic lockfile', async () => {
  const fixture = JSON.parse(await readFile(path.join(PKG_ROOT, 'tests/registry-fixture.json'), 'utf8'));
  const first = resolveDependencies(fixture.packages, { 'ross-core': '1.0.0' }, { rootName: 'app', rootVersion: '1.0.0' });
  const second = resolveDependencies(fixture.packages, { 'ross-core': '1.0.0' }, { rootName: 'app', rootVersion: '1.0.0' });
  assert.equal(first.digest, second.digest);
  assert.equal(first.lockfile.packages['left-pad-lite'].version, '1.1.0');
  assert.equal(first.lockfile.packages['is-number-lite'].version, '1.0.0');
});

test('MCP initialize and tools/list return stable shapes', () => {
  const server = createMcpServer();
  const init = server.handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } }
  });
  assert.equal(init.result.serverInfo.name, 'ROSS.CO Infinite MCP');
  const tools = server.handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.ok(tools.result.tools.some((t) => t.name === 'ross_hash'));
});

test('registry health and publish', async () => {
  const registry = createRegistry({ dataDir: undefined });
  const published = registry.publish('@ross/demo', '1.0.0', { description: 'demo' });
  assert.match(published.digest, /^sha256:/);
  let status = 0;
  let payload = null;
  await registry.handle(
    { method: 'GET', url: '/health', headers: { host: 'localhost' } },
    {
      writeHead(code) {
        status = code;
      },
      end(body) {
        payload = JSON.parse(body);
      }
    }
  );
  assert.equal(status, 200);
  assert.equal(payload.ok, true);
});

test('ownership config validates and SEO generate/prevalidate work', async () => {
  const { config } = await loadOwnershipConfig(PKG_ROOT);
  assert.equal(config.owner.ownerAssertion, true);
  assert.equal(validateOwnershipConfig(config).length, 0);
  const plan = ownershipPlan(config);
  assert.ok(plan.properties.some((p) => p.host === 'ross.co'));

  const dir = await mkdtemp(path.join(os.tmpdir(), 'ross-seo-'));
  try {
    // isolate generated assets/evidence under temp by cloning config output paths
    const localConfig = {
      ...config,
      output: { publicDir: 'seo/generated/public', evidenceDir: 'release-evidence/seo' }
    };
    await mkdir(path.join(dir, 'config/seo'), { recursive: true });
    const generated = await generateSeoAssets(dir, localConfig, {
      env: { INDEXNOW_KEY: 'a'.repeat(32), GOOGLE_SITE_VERIFICATION_TOKEN: 'google-token', BING_SITE_AUTH_TOKEN: 'bing-token' }
    });
    assert.ok(generated.files.some((f) => f.endsWith('sitemap.xml')));
    const report = await prevalidateOwnership(dir, localConfig, {
      env: { INDEXNOW_KEY: 'a'.repeat(32), GOOGLE_SITE_VERIFICATION_TOKEN: 'google-token', BING_SITE_AUTH_TOKEN: 'bing-token' }
    });
    assert.equal(report.ok, true);
    assert.equal(report.state, 'PREVALIDATED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('task graph plans default critical path', async () => {
  const taskfile = JSON.parse(await readFile(path.join(PKG_ROOT, 'ross.tasks.json'), 'utf8'));
  const graph = buildGraph(taskfile, 'default');
  assert.ok(graph.nodes.includes('test:unit'));
  const plan = await planTasks(taskfile, 'default', { root: PKG_ROOT, jobs: 2 });
  assert.ok(plan.order.includes('build:evidence'));
  assert.ok(plan.criticalPath.path.length > 0);
});

test('doctor and policy-check pass for package', async () => {
  const health = await doctor(PKG_ROOT);
  assert.equal(health.ok, true, JSON.stringify(health.checks, null, 2));
  const policy = await policyCheck(PKG_ROOT, 'package.json', 'config/production-policy.json');
  assert.equal(policy.ok, true, JSON.stringify(policy.findings, null, 2));
});
