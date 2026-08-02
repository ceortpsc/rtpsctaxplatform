import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRateLimiter,
  createSecurityAuditLog,
  decryptField,
  encryptField,
  evaluateSecurityPosture,
  mintAccessToken,
  timingSafeEqualString,
  verifyAccessToken
} from '../packages/security-core/src/index.mjs';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('timing-safe compare handles equal and unequal strings', () => {
  assert.equal(timingSafeEqualString('abc', 'abc'), true);
  assert.equal(timingSafeEqualString('abc', 'abd'), false);
  assert.equal(timingSafeEqualString('abc', 'abcd'), false);
});

test('HMAC access tokens mint and verify with scope + expiry checks', () => {
  const secret = 'unit-test-session-secret-value';
  const minted = mintAccessToken(
    { sub: 'rtp_api_1', kind: 'api', scopes: ['api:read', 'refund:read'] },
    { secret, ttlSec: 120 }
  );
  assert.equal(minted.ok, true);
  const ok = verifyAccessToken(minted.accessToken, { secret, requiredScope: 'refund:read' });
  assert.equal(ok.ok, true);
  assert.equal(ok.claims.sub, 'rtp_api_1');

  const scopeFail = verifyAccessToken(minted.accessToken, { secret, requiredScope: 'refund:admin' });
  assert.equal(scopeFail.ok, false);
  assert.equal(scopeFail.code, 'insufficient_scope');

  const bad = verifyAccessToken(minted.accessToken + 'x', { secret });
  assert.equal(bad.ok, false);

  const expired = mintAccessToken({ sub: 'x', scopes: [] }, { secret, ttlSec: 1, now: () => 0 });
  const expiredCheck = verifyAccessToken(expired.accessToken, { secret, now: () => 5_000 });
  assert.equal(expiredCheck.ok, false);
  assert.equal(expiredCheck.code, 'token_expired');
});

test('token minting fails closed without session secret', () => {
  const result = mintAccessToken({ sub: 'x' }, { secret: null });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'session_secret_unset');
});

test('AES-256-GCM field encryption round-trips and rejects tampering', () => {
  const key = Buffer.from('0123456789abcdef0123456789abcdef');
  const enc = encryptField('taxpayer-ref-42', { key });
  assert.equal(enc.ok, true);
  const dec = decryptField(enc.ciphertext, { key });
  assert.equal(dec.ok, true);
  assert.equal(dec.plaintext, 'taxpayer-ref-42');

  const tampered = decryptField(enc.ciphertext.replace(/\.[^.]+$/, '.aaaa'), { key });
  assert.equal(tampered.ok, false);

  const unset = encryptField('x', { key: null });
  assert.equal(unset.ok, false);
  assert.equal(unset.code, 'encryption_key_unset');
});

test('rate limiter blocks after limit', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(limiter.allow('ip1').ok, true);
  assert.equal(limiter.allow('ip1').ok, true);
  assert.equal(limiter.allow('ip1').ok, false);
  assert.equal(limiter.allow('ip2').ok, true);
});

test('security audit redacts secret-like fields and persists', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sec-audit-'));
  const audit = createSecurityAuditLog({
    auditPath: path.join(dir, 'audit.jsonl'),
    persist: true
  });
  const entry = await audit.record({
    action: 'probe',
    clientSecret: 'should-not-remain',
    outcome: 'ok'
  });
  assert.equal(entry.clientSecret, '[redacted]');
  assert.ok(audit.list(1)[0].id);
});

test('security posture reports fail-closed reasons', () => {
  const posture = evaluateSecurityPosture({
    env: { APP_ENV: 'local' },
    encryption: false,
    session: false,
    tunnelGate: { ready: false, status: 'stub', reasons: ['no tunnel'] },
    secretsStatus: { ready: false, summary: 'missing secrets', configuredGroups: [] }
  });
  assert.equal(posture.readyForHardenedAuth, false);
  assert.ok(posture.reasons.length >= 2);
  assert.deepEqual(posture.hardenedHeaders.includes('Content-Security-Policy'), true);
});
