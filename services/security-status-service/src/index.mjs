// Security status service — operator-facing redacted security posture APIs.
// Port 3007. No secrets in responses.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  applySecurityHeaders,
  createRateLimiter,
  createSecurityAuditLog,
  createSecurityCoreDescriptor,
  evaluateSecurityPosture,
  SECURITY_HEADERS
} from '../../../packages/security-core/src/index.mjs';
import { createSecretsConfigDescriptor, evaluateSecretsStatus, listSecretCatalog } from '../../../packages/secrets-config/src/index.mjs';
import { createSecureTunnelAdapter, evaluateTunnelGate } from '../../../packages/secure-tunnel/src/index.mjs';
import {
  createServiceDescriptor,
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  readJsonBody,
  redactConfig,
  sendJson,
  startHttpService
} from '../../../packages/platform-core/src/index.mjs';

const DEFAULT_PORT = 3007;
const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
const audit = createSecurityAuditLog();

export const securityStatusDescriptor = createServiceDescriptor({
  name: 'security-status-service',
  domain: 'security',
  responsibilities: [
    'Expose redacted security posture, secrets readiness, and tunnel gate status.',
    'Apply hardened HTTP headers and rate limits on operator security APIs.',
    'Append security audit events without logging secret values.'
  ],
  dependencies: ['@rtp/security-core', '@rtp/secrets-config', '@rtp/secure-tunnel']
});

function clientKey(request) {
  return request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'local';
}

function guardedSend(response, status, body) {
  applySecurityHeaders(response);
  sendJson(response, status, body);
}

export function createSecurityRoutes() {
  return {
    'GET /api/security/status': async ({ request, response, config }) => {
      const rate = limiter.allow(clientKey(request));
      if (!rate.ok) {
        response.setHeader('Retry-After', String(Math.ceil(rate.retryAfterMs / 1000) || 1));
        return guardedSend(response, 429, { error: 'rate_limited', retryAfterMs: rate.retryAfterMs });
      }
      const secrets = evaluateSecretsStatus({ env: process.env });
      const tunnelGate = evaluateTunnelGate({ env: process.env });
      const posture = evaluateSecurityPosture({
        env: process.env,
        tunnelGate,
        secretsStatus: secrets
      });
      await audit.record({ action: 'security.status', outcome: 'ok', source: 'security-status-service' });
      return guardedSend(response, 200, {
        identity: PLATFORM_IDENTITY,
        posture,
        environmentProtection: evaluateEnvironmentProtection(config),
        headersPolicy: SECURITY_HEADERS,
        core: createSecurityCoreDescriptor()
      });
    },
    'GET /api/security/secrets': async ({ request, response }) => {
      const rate = limiter.allow(clientKey(request));
      if (!rate.ok) {
        return guardedSend(response, 429, { error: 'rate_limited' });
      }
      const status = evaluateSecretsStatus({ env: process.env });
      await audit.record({ action: 'security.secrets', outcome: status.ready ? 'ready' : 'incomplete' });
      return guardedSend(response, 200, {
        identity: PLATFORM_IDENTITY,
        catalog: listSecretCatalog(),
        status,
        descriptor: createSecretsConfigDescriptor()
      });
    },
    'GET /api/security/tunnel': async ({ request, response }) => {
      const rate = limiter.allow(clientKey(request));
      if (!rate.ok) {
        return guardedSend(response, 429, { error: 'rate_limited' });
      }
      const adapter = createSecureTunnelAdapter();
      await audit.record({ action: 'security.tunnel', outcome: adapter.status });
      return guardedSend(response, 200, { identity: PLATFORM_IDENTITY, secureTunnel: adapter });
    },
    'GET /api/security/audit': async ({ request, response }) => {
      const rate = limiter.allow(clientKey(request));
      if (!rate.ok) {
        return guardedSend(response, 429, { error: 'rate_limited' });
      }
      return guardedSend(response, 200, { identity: PLATFORM_IDENTITY, events: audit.list(50) });
    },
    'POST /api/security/audit': async ({ request, response }) => {
      const rate = limiter.allow(clientKey(request));
      if (!rate.ok) {
        return guardedSend(response, 429, { error: 'rate_limited' });
      }
      const body = await readJsonBody(request, { limitBytes: 32_000 });
      const entry = await audit.record({
        action: body.action || 'security.custom',
        outcome: body.outcome || 'recorded',
        detail: body.detail || null,
        source: 'security-status-service'
      });
      return guardedSend(response, 201, { recorded: true, entry });
    }
  };
}

export function start() {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const secrets = evaluateSecretsStatus({ env: process.env });
  const tunnel = createSecureTunnelAdapter();
  return startHttpService({
    descriptor: securityStatusDescriptor,
    defaultPort: DEFAULT_PORT,
    routes: createSecurityRoutes(),
    extraMetadata: {
      security: evaluateSecurityPosture({
        env: process.env,
        tunnelGate: tunnel.gate,
        secretsStatus: secrets
      }),
      secureTunnel: tunnel,
      secretsSummary: secrets.summary,
      routes: [
        '/api/security/status',
        '/api/security/secrets',
        '/api/security/tunnel',
        '/api/security/audit'
      ]
    },
    onReady: () => {
      console.log(
        `security-status-service listening on http://localhost:${config.servicePort} (${config.appEnv})`
      );
    }
  });
}

export { redactConfig };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
