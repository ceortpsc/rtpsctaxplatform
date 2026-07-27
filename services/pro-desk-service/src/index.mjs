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
import {
  buildSuperiorityScorecard,
  describeProSuperiority,
  listDifferentiators
} from '../../../packages/pro-superiority/src/index.mjs';
import {
  createTaxPrepStore,
  describeTaxPrep,
  listForms,
  listInterviewModules
} from '../../../packages/tax-prep/src/index.mjs';
import { AI_HARD_PROHIBITIONS } from '../../../packages/ero-governance/src/index.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3007;

export const proDeskDescriptor = createServiceDescriptor({
  name: 'pro-desk-service',
  domain: 'operations',
  responsibilities: [
    'Operate the Pro Desk that positions RTPSC ahead of TaxSlayer Pro–class software.',
    'Run tax-prep interview, form selection, and return diagnostics with ROI linkage.',
    'Publish the competitive superiority scorecard and deep-link into refund/CRM/enrollment desks.'
  ],
  dependencies: ['@rtp/pro-superiority', '@rtp/tax-prep', '@rtp/ero-governance', '@rtp/platform-core']
});

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
        reject(new Error('Invalid JSON body.'));
      }
    });
    request.on('error', reject);
  });
}

async function serveStatic(response, pathname) {
  const safe = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(publicDir, safe));
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[ext] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

const OPS_LINKS = Object.freeze([
  { id: 'refund', label: 'Refund center', port: 3001, href: 'http://localhost:3001/' },
  { id: 'enrollment', label: 'SBTPG enrollment', port: 3004, href: 'http://localhost:3004/' },
  { id: 'invoice', label: 'Invoicing machine', port: 3005, href: 'http://localhost:3005/' },
  { id: 'pos-crm', label: 'POS · CRM · ERO', port: 3006, href: 'http://localhost:3006/' },
  { id: 'dashboard', label: 'Modules catalog', port: 3010, href: 'http://localhost:3010/' },
  { id: 'ai-workforce', label: 'AI workforce hub', port: 8860, href: 'http://localhost:8860/' },
  { id: 'ross', label: 'RunTime AI Assist', port: 8787, href: 'http://127.0.0.1:8787/' }
]);

export function createProDeskServer(overrides = {}) {
  const config = loadRuntimeConfig({
    serviceName: 'pro-desk-service',
    servicePort: overrides.port ?? Number(process.env.PRO_DESK_PORT || DEFAULT_PORT)
  });
  const prep = overrides.prepStore ?? createTaxPrepStore();
  const envProtection = evaluateEnvironmentProtection(config);

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    try {
      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, {
          status: 'ok',
          service: 'pro-desk-service',
          port: config.servicePort,
          company: PLATFORM_IDENTITY.company
        });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          descriptor: proDeskDescriptor,
          superiority: describeProSuperiority(),
          taxPrep: describeTaxPrep(),
          envProtection: {
            protected: envProtection.protected,
            transmissionAllowed: envProtection.transmissionAllowed,
            reasons: envProtection.reasons
          },
          config: redactConfig(config),
          opsLinks: OPS_LINKS
        });
      }

      if (request.method === 'GET' && pathname === '/api/scorecard') {
        return sendJson(response, 200, buildSuperiorityScorecard());
      }

      if (request.method === 'GET' && pathname === '/api/differentiators') {
        return sendJson(response, 200, { items: listDifferentiators() });
      }

      if (request.method === 'GET' && pathname === '/api/guardrails') {
        return sendJson(response, 200, {
          aiHardProhibitions: [...AI_HARD_PROHIBITIONS],
          envProtection,
          efileNotice: 'Live MeF transmit stays held until secure tunnel + compliance sign-off.'
        });
      }

      if (request.method === 'GET' && pathname === '/api/ops') {
        return sendJson(response, 200, { links: OPS_LINKS });
      }

      if (request.method === 'GET' && pathname === '/api/prep/modules') {
        return sendJson(response, 200, { modules: listInterviewModules(), forms: listForms() });
      }

      if (request.method === 'GET' && pathname === '/api/prep/returns') {
        return sendJson(response, 200, { returns: prep.list() });
      }

      if (request.method === 'POST' && pathname === '/api/prep/returns') {
        const body = await readBody(request);
        const record = prep.createReturn(body);
        return sendJson(response, 201, record);
      }

      const prepMatch = pathname.match(/^\/api\/prep\/returns\/([^/]+)(?:\/(interview|diagnostics|advance))?$/);
      if (prepMatch) {
        const id = decodeURIComponent(prepMatch[1]);
        const action = prepMatch[2] || null;

        if (request.method === 'GET' && !action) {
          const record = prep.get(id);
          if (!record) return sendJson(response, 404, { error: 'not_found' });
          return sendJson(response, 200, record);
        }

        if (request.method === 'POST' && action === 'interview') {
          const body = await readBody(request);
          return sendJson(response, 200, prep.updateInterview(id, body));
        }

        if (request.method === 'POST' && action === 'diagnostics') {
          return sendJson(response, 200, prep.runDiagnostics(id));
        }

        if (request.method === 'POST' && action === 'advance') {
          const body = await readBody(request);
          return sendJson(response, 200, prep.advance(id, body.stage));
        }
      }

      if (request.method === 'GET') return serveStatic(response, pathname);

      sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
    } catch (error) {
      sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });

  return { server, config, prep };
}

export function start() {
  const context = createProDeskServer();
  context.server.listen(context.config.servicePort, () => {
    console.log(
      `pro-desk-service listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`
    );
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
