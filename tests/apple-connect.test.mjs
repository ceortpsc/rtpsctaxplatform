import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createAppStoreConnectToken,
  evaluateAppleConnectGate,
  loadAppleConnectConfig,
  redactAppleConnectConfig,
  REQUIRED_SETUP_STEPS,
  CAPABILITY_CATALOG,
  listApps
} from '../packages/apple-connect/src/index.mjs';

test('Apple config redacts private key material', () => {
  const config = loadAppleConnectConfig({
    issuerId: 'issuer-uuid',
    keyId: 'ABC123DEFG',
    privateKeyPath: '/tmp/AuthKey.p8',
    enabled: false
  });
  const redacted = redactAppleConnectConfig(config);
  assert.equal(redacted.issuerId, 'issuer-uuid');
  assert.equal(redacted.privateKeyPath, '[configured]');
  assert.equal(redacted.secretsConfigured, true);
  assert.equal(Object.prototype.hasOwnProperty.call(redacted, 'privateKeyPem') || redacted.privateKeyPem === 'unset' || redacted.privateKeyPem === '[configured]', true);
});

test('gate blocks live calls until enabled + secrets', () => {
  const gate = evaluateAppleConnectGate(
    loadAppleConnectConfig({
      issuerId: 'issuer',
      keyId: 'kid',
      privateKeyPath: '/tmp/key.p8',
      enabled: false
    })
  );
  assert.equal(gate.liveCallsAllowed, false);
  assert.ok(gate.reasons.some((r) => /APPLE_CONNECT_ENABLED/.test(r)));
});

test('ES256 App Store Connect JWT verifies', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const token = createAppStoreConnectToken({
    issuerId: 'issuer-1',
    keyId: 'KEYID12345',
    privateKeyPem,
    now: 1_700_000_000_000,
    ttlSeconds: 600
  });
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  assert.equal(header.alg, 'ES256');
  assert.equal(header.kid, 'KEYID12345');
  assert.equal(payload.iss, 'issuer-1');
  assert.equal(payload.aud, 'appstoreconnect-v1');
  assert.equal(payload.exp - payload.iat, 600);

  const verified = crypto.verify(
    'SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(signatureB64, 'base64url')
  );
  assert.equal(verified, true);
});

test('listApps fails closed without credentials', async () => {
  await assert.rejects(
    () => listApps(loadAppleConnectConfig({})),
    (error) => error.code === 'credentials_not_configured'
  );
});

test('setup checklist and capabilities are published', () => {
  assert.ok(REQUIRED_SETUP_STEPS.length >= 5);
  assert.ok(CAPABILITY_CATALOG.some((c) => c.id === 'asc_api'));
});
