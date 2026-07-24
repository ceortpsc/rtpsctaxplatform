import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createServiceDescriptor,
  loadRuntimeConfig,
  redactConfig
} from '../../../packages/platform-core/src/index.mjs';
import { createPlatformRegistry } from './registry.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3010;

export const dashboardDescriptor = createServiceDescriptor({
  name: 'workflow-dashboard',
  domain: 'operations',
  responsibilities: [
    'Serve the interactive workflow operations dashboard.',
    'Expose REST endpoints to list, trigger, and inspect modular workflows.',
    'Surface live run history, triggers, and per-step task outcomes.'
  ],
  dependencies: ['refund-status-workflow', 'transcript-intake-workflow', 'transmission-workflow']
});

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(payload);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
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

async function serveStatic(response, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.join(publicDir, relative);
  // Prevent path traversal outside the public directory.
  if (!resolved.startsWith(publicDir)) {
    sendJson(response, 403, { error: 'forbidden' });
    return;
  }
  try {
    const file = await readFile(resolved);
    const ext = path.extname(resolved);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream' });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: 'not_found', path: urlPath });
  }
}

export function createDashboardServer({ registry, runner, triggers } = createPlatformRegistry()) {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      if (request.method === 'GET' && pathname === '/health') {
        sendJson(response, 200, { status: 'ok', service: dashboardDescriptor.name, environment: config.appEnv });
        return;
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        sendJson(response, 200, {
          service: dashboardDescriptor,
          runtime: redactConfig(config),
          metadata: {
            workflowCount: registry.list().length,
            eventTriggers: triggers.eventNames(),
            scheduledWorkflows: triggers.scheduledWorkflows()
          }
        });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/workflows') {
        sendJson(response, 200, { workflows: registry.describe() });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/runs') {
        sendJson(response, 200, { stats: runner.stats(), runs: runner.listRuns() });
        return;
      }

      const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (request.method === 'GET' && runMatch) {
        const record = runner.getRun(decodeURIComponent(runMatch[1]));
        if (!record) {
          sendJson(response, 404, { error: 'run_not_found', id: runMatch[1] });
          return;
        }
        sendJson(response, 200, { run: record });
        return;
      }

      const triggerMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/run$/);
      if (request.method === 'POST' && triggerMatch) {
        const name = decodeURIComponent(triggerMatch[1]);
        if (!registry.has(name)) {
          sendJson(response, 404, { error: 'workflow_not_found', name });
          return;
        }
        const input = await readRequestBody(request);
        const record = await triggers.fireManual(name, input);
        sendJson(response, 200, { run: record });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/events') {
        const body = await readRequestBody(request);
        if (!body.event) {
          sendJson(response, 400, { error: 'event_required' });
          return;
        }
        const records = await triggers.emit(body.event, body.payload ?? {});
        sendJson(response, 200, { event: body.event, triggered: records.length, runs: records });
        return;
      }

      if (request.method === 'GET') {
        await serveStatic(response, pathname);
        return;
      }

      sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
    } catch (error) {
      sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });

  return { server, config, registry, runner, triggers };
}

export function start() {
  const context = createDashboardServer();
  context.triggers.startSchedules();
  context.server.listen(context.config.servicePort, () => {
    console.log(
      `workflow-dashboard listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`
    );
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
