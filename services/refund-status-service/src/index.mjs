import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createServiceDescriptor,
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  redactConfig
} from '../../../packages/platform-core/src/index.mjs';
import { createRefundStore } from '../../../packages/refund-core/src/index.mjs';
import { createClientRegistry, extractClientCredentials } from '../../../packages/client-identity/src/index.mjs';
import { serveDesignSystemAsset } from '../../../packages/ui-design-system/src/index.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3001;

export const refundStatusDescriptor = createServiceDescriptor({
  name: 'refund-status-service',
  domain: 'refund-status',
  responsibilities: [
    'Ingest refund status events from approved sources only (no scraping).',
    'Maintain full refund cases, timelines, pipeline stages, and intelligence.',
    'Require API/TDS client authentication for write paths.'
  ],
  dependencies: ['refund-status-pipeline', 'refund-intelligence-engine', '@rtp/refund-core', '@rtp/client-identity']
});

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJson(response, statusCode, body) {
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

async function serveStatic(response, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.join(publicDir, relative);
  if (!resolved.startsWith(publicDir)) return sendJson(response, 403, { error: 'forbidden' });
  try {
    const file = await readFile(resolved);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(resolved)] ?? 'application/octet-stream' });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: 'not_found', path: urlPath });
  }
}

function clientMeta(request) {
  return {
    source: 'refund-status-service',
    ip: request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || request.socket?.remoteAddress || null
  };
}

export function createRefundStatusServer({ registry, store } = {}) {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const clients = registry ?? createClientRegistry();
  const refunds = store ?? createRefundStore();
  let bootstrapped = false;

  async function ensureClients() {
    if (bootstrapped) return;
    await clients.loadPersisted();
    clients.seedFromEnv();
    await clients.ensureLocalClients();
    bootstrapped = true;
  }

  async function requireClient(request, body, { kind, scope } = {}) {
    await ensureClients();
    const creds = extractClientCredentials(request, body);
    const auth = await clients.authenticate({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      kind,
      requiredScope: scope,
      meta: clientMeta(request)
    });
    if (!auth.ok) {
      const error = new Error(auth.message);
      error.statusCode = 401;
      error.code = auth.code;
      throw error;
    }
    return auth.client;
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      await ensureClients();

      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { status: 'ok', service: refundStatusDescriptor.name, environment: config.appEnv });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: refundStatusDescriptor,
          runtime: redactConfig(config),
          environmentProtection: evaluateEnvironmentProtection(config),
          clients: clients.status(),
          catalog: refunds.catalog(),
          metadata: {
            cases: refunds.listCases({ limit: 1000 }).length,
            channels: refunds.catalog().channels,
            ingestionPolicy: refunds.catalog().ingestionPolicy
          }
        });
      }

      if (request.method === 'GET' && pathname === '/api/catalog') {
        return sendJson(response, 200, refunds.catalog());
      }

      if (request.method === 'GET' && pathname === '/api/clients') {
        return sendJson(response, 200, clients.status());
      }

      if (request.method === 'GET' && pathname === '/api/cases') {
        const taxpayerRef = url.searchParams.get('taxpayerRef') ?? undefined;
        return sendJson(response, 200, { cases: refunds.listCases({ taxpayerRef }) });
      }

      const caseMatch = pathname.match(/^\/api\/cases\/([^/]+)(?:\/(timeline))?$/);
      if (request.method === 'GET' && caseMatch) {
        const id = decodeURIComponent(caseMatch[1]);
        if (caseMatch[2] === 'timeline') {
          const timeline = refunds.getTimeline(id);
          if (!timeline) return sendJson(response, 404, { error: 'case_not_found', id });
          return sendJson(response, 200, timeline);
        }
        const record = refunds.getCase(id);
        if (!record) return sendJson(response, 404, { error: 'case_not_found', id });
        return sendJson(response, 200, { case: record });
      }

      if (request.method === 'POST' && pathname === '/api/events') {
        const body = await readBody(request);
        const client = await requireClient(request, body, { scope: 'refund:ingest' });
        try {
          const result = await refunds.ingestEvent(body, {
            source: body.source ?? `client:${client.kind}`,
            clientIdHint: client.idHint
          });
          return sendJson(response, 201, { ...result, authenticatedClient: client });
        } catch (error) {
          return sendJson(response, 400, { error: 'ingest_failed', message: error.message });
        }
      }

      if (request.method === 'POST' && pathname === '/api/refunds/full') {
        // Convenience: create a full refund case in one shot (still requires auth)
        const body = await readBody(request);
        const client = await requireClient(request, body, { scope: 'refund:ingest' });
        const caseId = body.caseId ?? `CASE-${Date.now().toString(36).toUpperCase()}`;
        const stages = body.stages ?? ['received', 'processing', 'approved', 'sent'];
        let latest = null;
        for (const filingStage of stages) {
          latest = await refunds.ingestEvent(
            {
              caseId,
              taxpayerRef: body.taxpayerRef ?? 'TP-FULL',
              filingStage,
              amount: body.amount ?? 3200,
              hasTranscript: body.hasTranscript !== false,
              sbtpgEnrolled: body.sbtpgEnrolled === true,
              posPaid: body.posPaid === true,
              source: body.source ?? 'full-refund-demo'
            },
            { source: `full:${client.kind}`, clientIdHint: client.idHint }
          );
        }
        return sendJson(response, 201, { case: latest.case, authenticatedClient: client });
      }

      if (request.method === 'GET' && pathname === '/api/events') {
        return sendJson(response, 200, { events: refunds.listEvents() });
      }

      if (serveDesignSystemAsset(response, request.url || pathname)) return;

      if (request.method === 'GET') return serveStatic(response, pathname);
      sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
    } catch (error) {
      const status = error.statusCode ?? 400;
      sendJson(response, status, { error: error.code ?? 'bad_request', message: error.message });
    }
  });

  return { server, config, clients, refunds };
}

export function start() {
  const context = createRefundStatusServer();
  context.server.listen(context.config.servicePort, async () => {
    await context.clients.loadPersisted();
    context.clients.seedFromEnv();
    const issued = await context.clients.ensureLocalClients();
    console.log(`refund-status-service listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`);
    if (issued.length) {
      console.log('Provisioned local client credentials (store secrets securely — shown once):');
      for (const item of issued) {
        console.log(JSON.stringify({
          kind: item.credentials.kind,
          clientId: item.credentials.clientId,
          clientSecret: item.credentials.clientSecret
        }));
      }
    }
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
