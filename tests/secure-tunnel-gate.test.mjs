import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecureTunnelAdapter, evaluateTunnelGate } from '../packages/secure-tunnel/src/index.mjs';

test('tunnel adapter remains stub for compliance BND-004', () => {
  const adapter = createSecureTunnelAdapter({
    env: {
      TUNNEL_CLIENT_ID: 'id',
      TUNNEL_CLIENT_SECRET: 'secret',
      APPROVED_TUNNEL_ENDPOINT: 'https://approved.example'
    }
  });
  assert.equal(adapter.status, 'stub');
  assert.equal(adapter.gate.status, 'stub');
  assert.equal(adapter.gate.liveTransportEnabled, false);
});

test('tunnel gate requires https approved endpoint and secrets', () => {
  const blocked = evaluateTunnelGate({ env: {} });
  assert.equal(blocked.configReady, false);

  const httpBlocked = evaluateTunnelGate({
    env: {
      TUNNEL_CLIENT_ID: 'id',
      TUNNEL_CLIENT_SECRET: 'secret',
      APPROVED_TUNNEL_ENDPOINT: 'http://insecure.example'
    }
  });
  assert.equal(httpBlocked.configReady, false);
  assert.ok(httpBlocked.reasons.some((r) => /https/i.test(r)));

  const ready = evaluateTunnelGate({
    env: {
      APP_ENV: 'local',
      TUNNEL_CLIENT_ID: 'id',
      TUNNEL_CLIENT_SECRET: 'secret',
      APPROVED_TUNNEL_ENDPOINT: 'https://approved.example/path'
    }
  });
  assert.equal(ready.configReady, true);
  assert.equal(ready.ready, true);
  assert.equal(ready.endpointHint, 'https://approved.example');
});

test('production tunnel gate requires BND-005 sign-off', () => {
  const env = {
    APP_ENV: 'prod',
    TUNNEL_CLIENT_ID: 'id',
    TUNNEL_CLIENT_SECRET: 'secret',
    APPROVED_TUNNEL_ENDPOINT: 'https://approved.example'
  };
  const without = evaluateTunnelGate({ env, signoffApproved: false });
  assert.equal(without.configReady, true);
  assert.equal(without.ready, false);
  assert.ok(without.reasons.some((r) => /BND-005/.test(r)));

  const withSignoff = evaluateTunnelGate({ env, signoffApproved: true });
  assert.equal(withSignoff.ready, true);
});
