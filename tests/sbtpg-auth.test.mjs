import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createSbtpgClearanceStore,
  redactUsername,
  sbtpgCredentialsConfigured,
  validateSbtpgLogin
} from '../packages/bank-products/src/auth.mjs';

test('validateSbtpgLogin clears only matching credentials', () => {
  const expected = { username: 'ops.user', secretConfigured: true, _secret: 'test-only-secret' };
  assert.equal(validateSbtpgLogin({ username: 'ops.user', secret: 'test-only-secret' }, expected).ok, true);
  assert.equal(validateSbtpgLogin({ username: 'ops.user', secret: 'wrong' }, expected).ok, false);
  assert.equal(validateSbtpgLogin({ username: 'other', secret: 'test-only-secret' }, expected).ok, false);
  assert.equal(validateSbtpgLogin({ username: '', secret: '' }, expected).code, 'missing_credentials');
  assert.match(redactUsername('ops.user'), /^op\*+r$/);
});

test('clearance store issues token, logs audit without secrets, supports logout', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sbtpg-audit-'));
  const auditPath = path.join(dir, 'audit.jsonl');
  const env = { SBTPG_USERNAME: 'ops.user', SBTPG_SECRET: 'test-only-secret' };
  assert.equal(sbtpgCredentialsConfigured(env), true);

  const store = createSbtpgClearanceStore({ env, auditPath, persist: true });
  const fail = await store.login({ username: 'ops.user', secret: 'nope', meta: { source: 'test', ip: '127.0.0.1' } });
  assert.equal(fail.cleared, false);

  const ok = await store.login({ username: 'ops.user', secret: 'test-only-secret', meta: { source: 'test' } });
  assert.equal(ok.cleared, true);
  assert.ok(ok.clearance.token.length >= 32);
  assert.equal(store.evaluateClearance(ok.clearance.token).cleared, true);

  const entries = store.listAudit({ limit: 10 });
  assert.ok(entries.some((e) => e.outcome === 'failure'));
  assert.ok(entries.some((e) => e.event === 'login_cleared'));
  for (const entry of entries) {
    assert.equal(JSON.stringify(entry).includes('test-only-secret'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(entry, 'secret'), false);
  }

  const persisted = await readFile(auditPath, 'utf8');
  assert.equal(persisted.includes('test-only-secret'), false);
  assert.match(persisted, /login_attempt/);

  await store.logout(ok.clearance.token);
  assert.equal(store.evaluateClearance(ok.clearance.token).cleared, false);
});
