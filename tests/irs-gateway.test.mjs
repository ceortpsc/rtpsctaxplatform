import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createClientAssertion,
  loadIrsConfig,
  redactIrsConfig,
  requestIrsAccessToken
} from '../services/irs-gateway/src/index.mjs';

test('IRS config redacts key path and detects missing secrets', () => {
  const config = loadIrsConfig({
    clientId: 'client-id',
    keyId: 'key-id',
    privateKeyPath: '/tmp/example.key',
    tokenUrl: 'https://api.irs.gov/oauth2/v1/token',
    scope: 'tds'
  });
  const redacted = redactIrsConfig(config);
  assert.equal(redacted.clientId, 'client-id');
  assert.equal(redacted.privateKeyPath, '[configured]');
  assert.equal(redacted.secretsConfigured, true);
  assert.equal(Object.prototype.hasOwnProperty.call(redacted, 'clientSecret'), false);
});

test('client assertion is a verifiable RS256 JWT', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const token = createClientAssertion({
    clientId: 'abc',
    keyId: 'kid-1',
    tokenUrl: 'https://api.irs.gov/oauth2/v1/token',
    privateKeyPem,
    now: 1_700_000_000_000
  });

  const [headerB64, payloadB64, signatureB64] = token.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  assert.equal(header.alg, 'RS256');
  assert.equal(header.kid, 'kid-1');
  assert.equal(payload.iss, 'abc');
  assert.equal(payload.aud, 'https://api.irs.gov/oauth2/v1/token');

  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    Buffer.from(signatureB64, 'base64url')
  );
  assert.equal(verified, true);
});

test('token request fails deterministically without credentials', async () => {
  await assert.rejects(
    () => requestIrsAccessToken(loadIrsConfig({})),
    (error) => error.code === 'credentials_not_configured'
  );
});
