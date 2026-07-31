import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  applyPlatformSecurityHeaders,
  createServiceDescriptor,
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  redactConfig
} from '../../../packages/platform-core/src/index.mjs';
import { createSecureTunnelAdapter, evaluateTunnelGate } from '../../../packages/secure-tunnel/src/index.mjs';
import { createClientRegistry, extractClientCredentials } from '../../../packages/client-identity/src/index.mjs';
import {
  applySecurityHeaders,
  createRateLimiter,
  createSecurityAuditLog,
  evaluateSecurityPosture,
  extractBearerToken,
  mintAccessToken,
  verifyAccessToken
} from '../../../packages/security-core/src/index.mjs';
import { evaluateSecretsStatus } from '../../../packages/secrets-config/src/index.mjs';

const DEFAULT_PORT = 3000;
const REFUND_UPSTREAM = process.env.REFUND_STATUS_URL ?? 'http://localhost:3001';

export const gatewayDescriptor = createServiceDescriptor({
  name: 'api-gateway',
  domain: 'ingress',
  responsibilities: [
    'Authenticate API client id/secret at the ingress edge.',
    'Mint HMAC-signed bearer tokens when SESSION_SECRET is provisioned.',
    'Apply security headers and rate limits on auth endpoints.',
    'Expose client registry status and proxy approved refund routes.',
    'Declare secure tunnel prerequisites and transmission disclaimers.'
  ],
  dependencies: [
    'refund-status-service',
    'transcript-service',
    'analytics-service',
    '@rtp/client-identity',
    '@rtp/security-core',
    '@rtp/secrets-config',
    '@rtp/secure-tunnel'
  ]
});

function sendJson(response, statusCode, body) {
  applySecurityHeaders(response);
  applyPlatformSecurityHeaders(response);
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 400_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw === '') return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

export function createGatewayServer({ registry, rateLimiter, auditLog } = {}) {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const clients = registry ?? createClientRegistry();
  const limiter = rateLimiter ?? createRateLimiter({ limit: 60, windowMs: 60_000 });
  const audit = auditLog ?? createSecurityAuditLog();
  let ready = false;

  async function ensure() {
    if (ready) return;
    await clients.loadPersisted();
    clients.seedFromEnv();
    await clients.ensureLocalClients();
    ready = true;
  }

  function rateKey(request, suffix = '') {
    const ip = request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'local';
    return `${ip}:${suffix}`;
  }

  async function authenticateRequest(request, body, { kind = 'api', requiredScope } = {}) {
    const bearer = extractBearerToken(request);
    if (bearer) {
      const verified = verifyAccessToken(bearer, { requiredScope });
      if (verified.ok) {
        return {
          ok: true,
          via: 'bearer',
          client: {
            id: verified.claims.sub,
            kind: verified.claims.kind,
            scopes: verified.claims.scopes
          }
        };
      }
      // If a bearer was presented but invalid, fail closed (do not fall back).
      return { ok: false, code: verified.code, message: verified.message };
    }

    const creds = extractClientCredentials(request, body);
    return clients.authenticate({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      kind,
      requiredScope,
      meta: { source: 'api-gateway', ip: request.socket?.remoteAddress ?? null }
    });
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      await ensure();
      applySecurityHeaders(response);

      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { status: 'ok', service: gatewayDescriptor.name, environment: config.appEnv });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        const secrets = evaluateSecretsStatus({ env: process.env });
        const tunnel = createSecureTunnelAdapter();
        const tunnelGate = evaluateTunnelGate({ env: process.env });
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: gatewayDescriptor,
          runtime: redactConfig(config),
          environmentProtection: evaluateEnvironmentProtection(config),
          secureTunnel: tunnel,
          security: evaluateSecurityPosture({
            env: process.env,
            tunnelGate,
            secretsStatus: secrets
          }),
          secretsSummary: secrets.summary,
          clients: clients.status(),
          metadata: {
            transmissionFlows: ['prepare', 'validate', 'queue', 'transmit', 'acknowledge'],
            refundUpstream: REFUND_UPSTREAM,
            routes: ['/api/clients', '/api/auth/token', '/api/auth/introspect', '/api/refund/*', '/api/security/status'],
            tokenMode: 'hmac-bearer-when-session-secret-set'
          }
        });
      }

      if (request.method === 'GET' && pathname === '/api/security/status') {
        const secrets = evaluateSecretsStatus({ env: process.env });
        const tunnelGate = evaluateTunnelGate({ env: process.env });
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          security: evaluateSecurityPosture({ env: process.env, tunnelGate, secretsStatus: secrets }),
          tunnelGate,
          secrets
        });
      }

      if (request.method === 'GET' && pathname === '/api/clients') {
        return sendJson(response, 200, clients.status());
      }

      if (request.method === 'POST' && pathname === '/api/auth/token') {
        const rate = limiter.allow(rateKey(request, 'auth-token'));
        if (!rate.ok) {
          response.setHeader('Retry-After', String(Math.ceil(rate.retryAfterMs / 1000) || 1));
          await audit.record({ action: 'auth.token', outcome: 'rate_limited' });
          return sendJson(response, 429, { error: 'rate_limited', retryAfterMs: rate.retryAfterMs });
        }

        const body = await readBody(request);
        const creds = extractClientCredentials(request, body);
        const auth = await clients.authenticate({
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          kind: body.kind ?? 'api',
          requiredScope: body.scope,
          meta: { source: 'api-gateway', ip: request.socket?.remoteAddress ?? null }
        });
        if (!auth.ok) {
          await audit.record({ action: 'auth.token', outcome: auth.code, clientIdHint: creds.clientId ? 'present' : 'missing' });
          return sendJson(response, 401, { error: auth.code, message: auth.message });
        }

        const minted = mintAccessToken(
          { sub: auth.client.id, kind: auth.client.kind, scopes: auth.client.scopes },
          { ttlSec: Number(body.ttlSec) || 3600 }
        );

        if (!minted.ok) {
          // Fail closed for signed tokens, but keep a demo opaque token for local scaffold when secret unset.
          const opaque = Buffer.from(`${auth.client.id}:${Date.now()}`, 'utf8').toString('base64url');
          await audit.record({ action: 'auth.token', outcome: 'opaque_fallback', reason: minted.code });
          return sendJson(response, 200, {
            authenticated: true,
            client: auth.client,
            accessToken: opaque,
            tokenType: 'Bearer',
            tokenMode: 'opaque_local_demo',
            warning: minted.message
          });
        }

        await audit.record({ action: 'auth.token', outcome: 'hmac_minted', clientId: auth.client.id });
        return sendJson(response, 200, {
          authenticated: true,
          client: auth.client,
          accessToken: minted.accessToken,
          tokenType: minted.tokenType,
          expiresIn: minted.expiresIn,
          expiresAt: minted.expiresAt,
          tokenMode: 'hmac_hs256',
          claims: { scopes: minted.claims.scopes, exp: minted.claims.exp, alg: minted.claims.alg }
        });
      }

      if (request.method === 'POST' && pathname === '/api/auth/introspect') {
        const rate = limiter.allow(rateKey(request, 'auth-introspect'));
        if (!rate.ok) {
          return sendJson(response, 429, { error: 'rate_limited' });
        }
        const body = await readBody(request);
        const token = body.token || extractBearerToken(request);
        const verified = verifyAccessToken(token, { requiredScope: body.scope || null });
        return sendJson(response, verified.ok ? 200 : 401, {
          active: verified.ok === true,
          ...(verified.ok ? { claims: verified.claims } : { error: verified.code, message: verified.message })
        });
      }

      // Proxy refund routes with API client auth or bearer token
      if (pathname.startsWith('/api/refund/') || pathname === '/api/refund') {
        const bodyText =
          request.method === 'GET' || request.method === 'HEAD'
            ? null
            : JSON.stringify(await readBody(request));
        const bodyObj = bodyText ? JSON.parse(bodyText) : {};
        const auth = await authenticateRequest(request, bodyObj, {
          kind: 'api',
          requiredScope: request.method === 'GET' ? 'refund:read' : 'refund:ingest'
        });
        if (!auth.ok) return sendJson(response, 401, { error: auth.code, message: auth.message });

        const targetPath = pathname.replace(/^\/api\/refund/, '/api') || '/api/cases';
        const target = new URL(targetPath + url.search, REFUND_UPSTREAM);
        const upstreamHeaders = { 'content-type': 'application/json' };
        const creds = extractClientCredentials(request, bodyObj);
        if (creds.clientId && creds.clientSecret) {
          upstreamHeaders['x-api-client-id'] = creds.clientId;
          upstreamHeaders['x-api-client-secret'] = creds.clientSecret;
        }
        const upstream = await fetch(target, {
          method: request.method,
          headers: upstreamHeaders,
          body: bodyText
        });
        const text = await upstream.text();
        applySecurityHeaders(response);
        response.writeHead(upstream.status, {
          'content-type': upstream.headers.get('content-type') ?? 'application/json'
        });
        response.end(text);
        return;
      }

      sendJson(response, 404, { error: 'not_found', service: gatewayDescriptor.name });
    } catch (error) {
      sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });

  return { server, config, clients, limiter, audit };
}

export function start() {
  const context = createGatewayServer();
  context.server.listen(context.config.servicePort, async () => {
    await context.clients.loadPersisted();
    context.clients.seedFromEnv();
    const issued = await context.clients.ensureLocalClients();
    console.log(`api-gateway listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`);
    if (issued.length) {
      console.log('Gateway provisioned local clients (shown once):');
      for (const item of issued) {
        console.log(
          JSON.stringify({
            kind: item.credentials.kind,
            clientId: item.credentials.clientId,
            clientSecret: item.credentials.clientSecret
          })
        );
      }
    }
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
