import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSecureTunnelAdapter,
  loadTunnelConfig,
  SERVICE_TOPOLOGY,
  APPROVED_EXTERNAL_ALLOWLIST
} from '../packages/secure-tunnel/src/index.mjs';

test('default adapter remains stub without tunnel env', () => {
  const tunnel = createSecureTunnelAdapter({
    tunnelClientId: 'unset',
    tunnelClientSecret: 'unset',
    approvedTunnelEndpoint: 'unset',
    runtime: { appEnv: 'local' }
  });
  assert.equal(tunnel.status, 'stub');
});

test('actual allowlisted endpoint + tunnel client yields configured (not live ready) in local', async () => {
  const tunnel = createSecureTunnelAdapter({
    tunnelClientId: 'rtp-tunnel-test',
    tunnelClientSecret: 'test-secret',
    approvedTunnelEndpoint: 'https://api.irs.gov/oauth2/v1/token',
    runtime: {
      appEnv: 'local',
      apiClientSecret: 'a',
      tdsClientSecret: 'b',
      tunnelClientSecret: 'test-secret',
      approvedTunnelEndpoint: 'https://api.irs.gov/oauth2/v1/token',
      efileTransmissionEnabled: false
    }
  });
  assert.equal(tunnel.status, 'configured');
  assert.equal(tunnel.mode, 'actual-config');
  assert.equal(tunnel.validateEndpoint('https://api.irs.gov/oauth2/v1/token').allowed, true);
  assert.equal(tunnel.validateEndpoint('http://evil.example/scrape').allowed, false);
  const handoff = await tunnel.transmit({ batchId: 'b1', documents: [1] });
  assert.equal(handoff.held, true);
  assert.equal(handoff.outcome, 'held-pending-approval');
});

test('topology exposes gateways services workers pipelines', () => {
  assert.ok(SERVICE_TOPOLOGY.some((s) => s.id === 'irs-gateway' && s.port === 8820));
  assert.ok(SERVICE_TOPOLOGY.some((s) => s.id === 'api-gateway'));
  assert.ok(APPROVED_EXTERNAL_ALLOWLIST.some((e) => e.id === 'irs-oauth'));
  const cfg = loadTunnelConfig({
    approvedTunnelEndpoint: 'https://api.irs.gov/',
    tunnelClientId: 'x',
    tunnelClientSecret: 'y'
  });
  assert.equal(cfg.approvedTunnelEndpoint, 'https://api.irs.gov/');
});
