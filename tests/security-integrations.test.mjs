import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayServer } from '../services/api-gateway/src/index.mjs';
import { createClientRegistry } from '../packages/client-identity/src/index.mjs';
import { createRateLimiter, createSecurityAuditLog, verifyAccessToken } from '../packages/security-core/src/index.mjs';
import { createSecurityRoutes, securityStatusDescriptor } from '../services/security-status-service/src/index.mjs';
import { runSecurityScan, securityScannerDescriptor } from '../workers/security-scanner-worker/src/index.mjs';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve(port);
    });
  });
}

async function jsonRequest(port, method, urlPath, { headers = {}, body } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, headers: response.headers, json };
}

test('api-gateway mints HMAC token when SESSION_SECRET is set and applies security headers', async () => {
  const prev = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'gateway-integration-session-secret';
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gw-sec-'));
  const registry = createClientRegistry({
    env: {},
    persist: true,
    registryPath: path.join(dir, 'registry.json'),
    auditPath: path.join(dir, 'audit.jsonl')
  });
  const issued = await registry.issueClient({ kind: 'api', name: 'Gateway Test' });
  const { server } = createGatewayServer({
    registry,
    rateLimiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    auditLog: createSecurityAuditLog({ persist: false })
  });
  const port = await listen(server);
  try {
    const tokenRes = await jsonRequest(port, 'POST', '/api/auth/token', {
      headers: {
        'x-api-client-id': issued.credentials.clientId,
        'x-api-client-secret': issued.credentials.clientSecret
      },
      body: { kind: 'api' }
    });
    assert.equal(tokenRes.status, 200);
    assert.equal(tokenRes.json.tokenMode, 'hmac_hs256');
    assert.equal(tokenRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(tokenRes.headers.get('x-frame-options'), 'DENY');

    const verified = verifyAccessToken(tokenRes.json.accessToken, {
      secret: 'gateway-integration-session-secret'
    });
    assert.equal(verified.ok, true);

    const introspect = await jsonRequest(port, 'POST', '/api/auth/introspect', {
      body: { token: tokenRes.json.accessToken }
    });
    assert.equal(introspect.status, 200);
    assert.equal(introspect.json.active, true);

    const meta = await jsonRequest(port, 'GET', '/metadata');
    assert.equal(meta.status, 200);
    assert.ok(meta.json.security);
    assert.ok(meta.json.secureTunnel.status === 'stub');
  } finally {
    server.close();
    if (prev === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prev;
  }
});

test('security-status routes and scanner worker produce redacted posture artifacts', async () => {
  assert.equal(securityStatusDescriptor.name, 'security-status-service');
  assert.equal(securityScannerDescriptor.name, 'security-scanner-worker');

  const routes = createSecurityRoutes();
  assert.ok(typeof routes['GET /api/security/status'] === 'function');

  const root = await mkdtemp(path.join(os.tmpdir(), 'sec-scan-'));
  const { report, outPath } = await runSecurityScan({
    env: {
      APP_ENV: 'local',
      API_CLIENT_ID: 'api-id',
      API_CLIENT_SECRET: 'api-secret-value',
      TDS_CLIENT_ID: 'tds-id',
      TDS_CLIENT_SECRET: 'tds-secret-value',
      TUNNEL_CLIENT_ID: 'tunnel-id',
      TUNNEL_CLIENT_SECRET: 'tunnel-secret-value',
      APPROVED_TUNNEL_ENDPOINT: 'https://approved.example',
      SESSION_SECRET: 'scan-session-secret',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef'
    },
    root
  });
  assert.equal(report.secrets.ready, true);
  assert.equal(report.tunnel.status, 'stub');
  const written = JSON.parse(await readFile(outPath, 'utf8'));
  assert.equal(written.identity.abbreviation, 'RTPSC');
  assert.equal(JSON.stringify(written).includes('scan-session-secret'), false);
});

test('security-status-service descriptor is wired for HTTP startHttpService routes', () => {
  // Ensure route map keys match startHttpService routeKey format.
  const routes = createSecurityRoutes();
  for (const key of Object.keys(routes)) {
    assert.match(key, /^(GET|POST) \//);
  }
  // Keep http import referenced for intentional service contract stability.
  assert.equal(typeof http.createServer, 'function');
});
