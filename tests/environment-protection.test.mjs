import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEnvironmentProtection,
  getPlatformRelease,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  releaseMetadataBlock
} from '../packages/platform-core/src/index.mjs';

test('platform identity is Ross Tax Pro Software Co / Efile Transmission Software', () => {
  assert.equal(PLATFORM_IDENTITY.company, 'Ross Tax Pro Software Co');
  assert.equal(PLATFORM_IDENTITY.application, 'Efile Transmission Software');
  assert.equal(PLATFORM_IDENTITY.abbreviation, 'RTPSC');
});

test('platform release metadata defaults to v2.0-dev', () => {
  const prev = process.env.RTPSC_RELEASE_CHANNEL;
  delete process.env.RTPSC_RELEASE_CHANNEL;
  try {
    const release = releaseMetadataBlock(getPlatformRelease());
    assert.equal(release.version, '2.0.0');
    assert.equal(release.channel, 'dev');
    assert.equal(release.tag, 'v2.0-dev');
  } finally {
    if (prev === undefined) delete process.env.RTPSC_RELEASE_CHANNEL;
    else process.env.RTPSC_RELEASE_CHANNEL = prev;
  }
});

test('local environment is protected and blocks transmission by default', () => {
  const result = evaluateEnvironmentProtection(loadRuntimeConfig({ appEnv: 'local' }));
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
