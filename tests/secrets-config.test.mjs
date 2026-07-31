import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSecretGroup,
  evaluateSecretsStatus,
  listSecretCatalog
} from '../packages/secrets-config/src/index.mjs';

test('secret catalog lists expected groups', () => {
  const catalog = listSecretCatalog();
  const groups = catalog.map((g) => g.group);
  for (const required of ['api', 'tds', 'tunnel', 'session', 'encryption', 'sbtpg', 'irs', 'tls']) {
    assert.ok(groups.includes(required), `missing group ${required}`);
  }
});

test('placeholder and unset values are not configured', () => {
  const group = evaluateSecretGroup('api', {
    API_CLIENT_ID: 'local-api-client-id',
    API_CLIENT_SECRET: 'replace-via-cursor-or-secret-store'
  });
  assert.equal(group.configured, false);
  assert.ok(group.missing.length >= 1);
});

test('session group accepts either SESSION_SECRET or JWT_SECRET', () => {
  const viaSession = evaluateSecretGroup('session', { SESSION_SECRET: 'a-real-session-secret-value' });
  assert.equal(viaSession.configured, true);
  const viaJwt = evaluateSecretGroup('session', { JWT_SECRET: 'a-real-jwt-secret-value' });
  assert.equal(viaJwt.configured, true);
  const neither = evaluateSecretGroup('session', {});
  assert.equal(neither.configured, false);
});

test('evaluateSecretsStatus is redacted and ready only when required groups complete', () => {
  const readyEnv = {
    API_CLIENT_ID: 'api-id',
    API_CLIENT_SECRET: 'api-secret-value',
    TDS_CLIENT_ID: 'tds-id',
    TDS_CLIENT_SECRET: 'tds-secret-value',
    TUNNEL_CLIENT_ID: 'tunnel-id',
    TUNNEL_CLIENT_SECRET: 'tunnel-secret-value',
    APPROVED_TUNNEL_ENDPOINT: 'https://approved.example',
    SESSION_SECRET: 'session-secret-value-xyz',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef'
  };
  const status = evaluateSecretsStatus({ env: readyEnv });
  assert.equal(status.ready, true);
  assert.equal(JSON.stringify(status).includes('session-secret-value-xyz'), false);

  const incomplete = evaluateSecretsStatus({ env: { APP_ENV: 'local' } });
  assert.equal(incomplete.ready, false);
  assert.ok(incomplete.missingRequired.length > 0);
});
