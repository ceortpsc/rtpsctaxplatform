import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createClientRegistry } from '../packages/client-identity/src/index.mjs';

test('issues full API and TDS clients and authenticates with scopes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'clients-'));
  const registry = createClientRegistry({
    env: {},
    persist: true,
    registryPath: path.join(dir, 'registry.json'),
    auditPath: path.join(dir, 'audit.jsonl')
  });

  const api = await registry.issueClient({ kind: 'api', name: 'Test API' });
  const tds = await registry.issueClient({ kind: 'tds', name: 'Test TDS' });
  assert.match(api.credentials.clientId, /^rtp_api_/);
  assert.match(tds.credentials.clientId, /^rtp_tds_/);
  assert.match(api.credentials.clientSecret, /^rtp_sk_/);

  const ok = await registry.authenticate({
    clientId: api.credentials.clientId,
    clientSecret: api.credentials.clientSecret,
    kind: 'api',
    requiredScope: 'refund:ingest'
  });
  assert.equal(ok.ok, true);

  const bad = await registry.authenticate({
    clientId: api.credentials.clientId,
    clientSecret: 'wrong',
    kind: 'api'
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'invalid_secret');

  const scopeFail = await registry.authenticate({
    clientId: tds.credentials.clientId,
    clientSecret: tds.credentials.clientSecret,
    kind: 'tds',
    requiredScope: 'refund:admin'
  });
  assert.equal(scopeFail.ok, false);

  const status = registry.status();
  assert.equal(status.apiProvisioned, true);
  assert.equal(status.tdsProvisioned, true);
  assert.ok(registry.listAudit().some((e) => e.outcome === 'success'));
  assert.ok(registry.listAudit().every((e) => !JSON.stringify(e).includes(api.credentials.clientSecret)));
});

test('seeds clients from environment placeholders when set', async () => {
  const registry = createClientRegistry({
    env: {
      API_CLIENT_ID: 'rtp_api_envdemo',
      API_CLIENT_SECRET: 'env-api-secret',
      TDS_CLIENT_ID: 'rtp_tds_envdemo',
      TDS_CLIENT_SECRET: 'env-tds-secret'
    },
    persist: false
  });
  assert.ok(registry.getClient('rtp_api_envdemo'));
  assert.ok(registry.getClient('rtp_tds_envdemo'));
  const auth = await registry.authenticate({
    clientId: 'rtp_api_envdemo',
    clientSecret: 'env-api-secret',
    kind: 'api'
  });
  assert.equal(auth.ok, true);
});
