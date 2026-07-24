import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRuntimeConfig, redactConfig } from '../../../packages/platform-core/src/index.mjs';
import { buildModuleCatalog, catalogSummary, modulesDashboardDescriptor } from './catalog.mjs';

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
        service: dashboardDescriptor,
        runtime: redactConfig(config),
        metadata: catalogSummary()
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/modules') {
      const catalog = buildModuleCatalog();
      sendJson(response, 200, { summary: catalogSummary(catalog), categories: catalog });
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
