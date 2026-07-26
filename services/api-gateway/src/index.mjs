import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createServiceDescriptor,
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  redactConfig
} from '../../../packages/platform-core/src/index.mjs';
import { createSecureTunnelAdapter } from '../../../packages/secure-tunnel/src/index.mjs';
import { createClientRegistry, extractClientCredentials } from '../../../packages/client-identity/src/index.mjs';
import { createSyncEngine } from '../../../packages/data-sync/src/index.mjs';

const DEFAULT_PORT = 3000;
const REFUND_UPSTREAM = process.env.REFUND_STATUS_URL ?? 'http://localhost:3001';
const SYNC_DIR = process.env.DATA_SYNC_DIR ?? path.resolve(process.cwd(), 'data', 'sync');
const SYNC_STORE = process.env.DATA_SYNC_STORE ?? path.join(SYNC_DIR, 'store.json');

export const gatewayDescriptor = createServiceDescriptor({
  name: 'api-gateway',
  domain: 'ingress',
  responsibilities: [
    'Authenticate API client id/secret at the ingress edge.',
    'Expose client registry status and proxy approved refund routes.',
    'Expose data & table synchronization status/import/run APIs.',
    'Declare secure tunnel prerequisites and transmission disclaimers.'
  ],
  dependencies: [
    'refund-status-service',
    'transcript-service',
    'analytics-service',
    '@rtp/client-identity',
    '@rtp/data-sync'
  ]
});

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

export function createGatewayServer({ registry, syncEngine } = {}) {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const clients = registry ?? createClientRegistry();
  const sync = syncEngine ?? createSyncEngine({ persistPath: SYNC_STORE });
  let ready = false;

  async function ensure() {
    if (ready) return;
    await clients.loadPersisted();
    clients.seedFromEnv();
    await clients.ensureLocalClients();
    await sync.store.loadPersisted();
    ready = true;
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      await ensure();

      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { status: 'ok', service: gatewayDescriptor.name, environment: config.appEnv });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: gatewayDescriptor,
          runtime: redactConfig(config),
          environmentProtection: evaluateEnvironmentProtection(config),
          secureTunnel: createSecureTunnelAdapter(),
          clients: clients.status(),
          dataSync: {
            counts: sync.store.count(),
            directory: SYNC_DIR
          },
          metadata: {
            transmissionFlows: ['prepare', 'validate', 'queue', 'transmit', 'acknowledge'],
            refundUpstream: REFUND_UPSTREAM,
            routes: ['/api/clients', '/api/auth/token', '/api/refund/*', '/api/sync', '/api/sync/*']
          }
        });
      }

      if (request.method === 'GET' && pathname === '/api/sync') {
        return sendJson(response, 200, { ...sync.status(), directory: SYNC_DIR });
      }

      if (request.method === 'GET' && pathname === '/api/sync/tables') {
        return sendJson(response, 200, {
          tables: sync.listTableSchemas().map((t) => ({
            ...t,
            count: sync.store.count(t.name)
          }))
        });
      }

      const syncTableMatch = pathname.match(/^\/api\/sync\/tables\/([^/]+)$/);
      if (request.method === 'GET' && syncTableMatch) {
        const name = decodeURIComponent(syncTableMatch[1]);
        try {
          const limit = Number(url.searchParams.get('limit') ?? 100);
          return sendJson(response, 200, {
            table: name,
            count: sync.store.count(name),
            rows: sync.store.list(name, { limit })
          });
        } catch (error) {
          return sendJson(response, 404, { error: 'unknown_table', message: error.message });
        }
      }

      if (request.method === 'POST' && pathname === '/api/sync/import') {
        const body = await readBody(request);
        const table = body.table;
        if (!table) return sendJson(response, 400, { error: 'table_required' });
        try {
          let result;
          if (body.csv) result = sync.importCsvText(table, body.csv, { source: body.source ?? 'api-gateway' });
          else if (Array.isArray(body.rows)) result = sync.importRows(table, body.rows, { source: body.source ?? 'api-gateway' });
          else return sendJson(response, 400, { error: 'csv_or_rows_required' });
          await sync.store.persist();
          return sendJson(response, 201, result);
        } catch (error) {
          return sendJson(response, 400, { error: 'import_failed', message: error.message });
        }
      }

      if (request.method === 'POST' && pathname === '/api/sync/run') {
        const body = await readBody(request);
        const result = await sync.runFullSync({
          directory: body.directory ?? SYNC_DIR,
          persist: body.persist !== false,
          includeTaxSeed: body.includeTaxSeed !== false
        });
        return sendJson(response, 200, {
          directory: result.directory,
          counts: result.counts,
          tables: result.tables,
          persist: result.persist,
          projections: Object.fromEntries(
            Object.entries(result.projection.projections).map(([k, v]) => [k, v.summary ?? v])
          )
        });
      }

      if (request.method === 'GET' && pathname === '/api/clients') {
        return sendJson(response, 200, clients.status());
      }

      if (request.method === 'POST' && pathname === '/api/auth/token') {
        const body = await readBody(request);
        const creds = extractClientCredentials(request, body);
        const auth = await clients.authenticate({
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          kind: body.kind ?? 'api',
          requiredScope: body.scope,
          meta: { source: 'api-gateway', ip: request.socket?.remoteAddress ?? null }
        });
        if (!auth.ok) return sendJson(response, 401, { error: auth.code, message: auth.message });
        return sendJson(response, 200, {
          authenticated: true,
          client: auth.client,
          // Opaque session token for downstream demos (not a JWT — local hash of id+time)
          accessToken: Buffer.from(`${auth.client.id}:${Date.now()}`, 'utf8').toString('base64url'),
          tokenType: 'Bearer'
        });
      }

      // Proxy refund routes with API client auth
      if (pathname.startsWith('/api/refund/') || pathname === '/api/refund') {
        const bodyText =
          request.method === 'GET' || request.method === 'HEAD'
            ? null
            : JSON.stringify(await readBody(request));
        const bodyObj = bodyText ? JSON.parse(bodyText) : {};
        const creds = extractClientCredentials(request, bodyObj);
        const auth = await clients.authenticate({
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          kind: 'api',
          requiredScope: request.method === 'GET' ? 'refund:read' : 'refund:ingest',
          meta: { source: 'api-gateway-proxy' }
        });
        if (!auth.ok) return sendJson(response, 401, { error: auth.code, message: auth.message });

        const targetPath = pathname.replace(/^\/api\/refund/, '/api') || '/api/cases';
        const target = new URL(targetPath + url.search, REFUND_UPSTREAM);
        const upstream = await fetch(target, {
          method: request.method,
          headers: {
            'content-type': 'application/json',
            'x-api-client-id': creds.clientId,
            'x-api-client-secret': creds.clientSecret
          },
          body: bodyText
        });
        const text = await upstream.text();
        response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
        response.end(text);
        return;
      }

      sendJson(response, 404, { error: 'not_found', service: gatewayDescriptor.name });
    } catch (error) {
      sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });

  return { server, config, clients, sync };
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
        console.log(JSON.stringify({ kind: item.credentials.kind, clientId: item.credentials.clientId, clientSecret: item.credentials.clientSecret }));
      }
    }
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
