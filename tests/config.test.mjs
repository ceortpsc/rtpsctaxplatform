import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntimeConfig, redactConfig } from '../packages/platform-core/src/index.mjs';

test('runtime config redacts secrets but preserves placeholders', () => {
  const config = loadRuntimeConfig({
    appEnv: 'stage',
    servicePort: 4300,
    apiClientId: 'api-id',
    apiClientSecret: 'api-secret',
    tdsClientId: 'tds-id',
    tdsClientSecret: 'tds-secret',
    tunnelClientId: 'tunnel-id',
    tunnelClientSecret: 'tunnel-secret',
    approvedTunnelEndpoint: 'https://approved.example'
  });

  const redacted = redactConfig(config);
  assert.equal(redacted.appEnv, 'stage');
  assert.equal(redacted.servicePort, 4300);
  assert.equal(redacted.apiClientId, 'api-id');
  assert.equal(redacted.approvedTunnelEndpoint, 'https://approved.example');
  assert.equal(redacted.secretsConfigured, true);
  assert.equal(Object.prototype.hasOwnProperty.call(redacted, 'apiClientSecret'), false);
});
