import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEnvironmentProtection, loadRuntimeConfig, PLATFORM_IDENTITY } from '../packages/platform-core/src/index.mjs';

test('platform identity is governed Ross Tax Pro Software Co v2.0-alpha', () => {
  assert.equal(PLATFORM_IDENTITY.company, 'Ross Tax Pro Software Co');
  assert.equal(PLATFORM_IDENTITY.application, 'Efile Transmission Software');
  assert.equal(PLATFORM_IDENTITY.abbreviation, 'RTPSC');
  assert.equal(PLATFORM_IDENTITY.product, 'Ross Tax Pro Software Co Enterprise Tax Platform');
  assert.equal(PLATFORM_IDENTITY.releaseLine, '2.0');
  assert.equal(PLATFORM_IDENTITY.release, 'v2.0-alpha');
  assert.equal(PLATFORM_IDENTITY.version, '2.0.0-alpha.0');
  assert.equal(PLATFORM_IDENTITY.channel, 'alpha');
  assert.equal(PLATFORM_IDENTITY.deploymentEnvironment, 'alpha');
});

test('local environment is protected and blocks transmission by default', () => {
  const result = evaluateEnvironmentProtection(loadRuntimeConfig({ appEnv: 'local' }));
  assert.equal(result.release, 'v2.0-alpha');
  assert.equal(result.version, '2.0.0-alpha.0');
  assert.equal(result.releaseChannel, 'alpha');
  assert.equal(result.protected, true);
  assert.equal(result.transmissionAllowed, false);
  assert.ok(result.reasons.some((r) => /not a production environment/.test(r)));
});

test('fully approved production environment permits transmission', () => {
  const config = loadRuntimeConfig({
    appEnv: 'prod',
    apiClientSecret: 'a',
    tdsClientSecret: 'b',
    tunnelClientSecret: 'c',
    approvedTunnelEndpoint: 'https://approved.example',
    efileTransmissionEnabled: true
  });
  const result = evaluateEnvironmentProtection(config);
  assert.equal(result.environment, 'production');
  assert.equal(result.transmissionAllowed, true);
  assert.equal(result.protected, false);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.safeguards.productionEnvironment, true);
  assert.equal(result.safeguards.approvedTunnel, true);
});

test('production without the explicit flag stays protected', () => {
  const config = loadRuntimeConfig({
    appEnv: 'prod',
    apiClientSecret: 'a',
    tdsClientSecret: 'b',
    tunnelClientSecret: 'c',
    approvedTunnelEndpoint: 'https://approved.example',
    efileTransmissionEnabled: false
  });
  const result = evaluateEnvironmentProtection(config);
  assert.equal(result.transmissionAllowed, false);
  assert.ok(result.reasons.some((r) => /EFILE_TRANSMISSION_ENABLED/.test(r)));
});
