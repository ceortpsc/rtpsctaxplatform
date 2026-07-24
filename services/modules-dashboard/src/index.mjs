import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  redactConfig
} from '../../../packages/platform-core/src/index.mjs';
import { answerQuery, buildDependencyGraph, buildInsights } from '../../../packages/module-advisor/src/index.mjs';
import { buildModuleCatalog, catalogSummary, modulesDashboardDescriptor, SERVICE_ENDPOINTS } from './catalog.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3010;

export const dashboardDescriptor = modulesDashboardDescriptor;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 100_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

async function probeService({ name, port }) {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`http://localhost:${port}/health`, { signal: controller.signal });
    let status = `http ${res.status}`;
    if (res.ok) {
      try {
        const body = await res.json();
        status = body.status ?? 'ok';
      } catch {
        status = 'ok';
      }
    }
    return { name, port, ok: res.ok, status, latencyMs: Date.now() - start };
  } catch {
    return { name, port, ok: false, status: 'unreachable', latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

async function serveStatic(response, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.join(publicDir, relative);
  if (!resolved.startsWith(publicDir)) {
    sendJson(response, 403, { error: 'forbidden' });
    return;
  }
  try {
    const file = await readFile(resolved);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(resolved)] ?? 'application/octet-stream' });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: 'not_found', path: urlPath });
  }
}

export function createDashboardServer() {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    if (request.method === 'GET' && pathname === '/health') {
      sendJson(response, 200, { status: 'ok', service: dashboardDescriptor.name, environment: config.appEnv });
      return;
    }

    if (request.method === 'GET' && pathname === '/metadata') {
      sendJson(response, 200, {
        identity: PLATFORM_IDENTITY,
        service: dashboardDescriptor,
        runtime: redactConfig(config),
        environmentProtection: evaluateEnvironmentProtection(config),
        metadata: catalogSummary()
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/environment') {
      sendJson(response, 200, {
        identity: PLATFORM_IDENTITY,
        ...evaluateEnvironmentProtection(config)
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/modules') {
      const catalog = buildModuleCatalog();
      sendJson(response, 200, { summary: catalogSummary(catalog), categories: catalog });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/insights') {
      sendJson(response, 200, buildInsights(buildModuleCatalog()));
      return;
    }

    if (request.method === 'GET' && pathname === '/api/graph') {
      sendJson(response, 200, buildDependencyGraph(buildModuleCatalog()));
      return;
    }

    if (request.method === 'GET' && pathname === '/api/status') {
      const services = await Promise.all(SERVICE_ENDPOINTS.map((endpoint) => probeService(endpoint)));
      sendJson(response, 200, {
        checkedAt: new Date().toISOString(),
        healthy: services.every((service) => service.ok),
        services
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/assistant') {
      try {
        const body = await readRequestBody(request);
        sendJson(response, 200, answerQuery(buildModuleCatalog(), body.query ?? ''));
      } catch (error) {
        sendJson(response, 400, { error: 'bad_request', message: error.message });
      }
      return;
    }

    if (request.method === 'GET') {
      await serveStatic(response, pathname);
      return;
    }

    sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
  });

  return { server, config };
}

export function start() {
  const context = createDashboardServer();
  context.server.listen(context.config.servicePort, () => {
    console.log(
      `modules-dashboard listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`
    );
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
