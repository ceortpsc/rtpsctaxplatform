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
import {
  createEnrollment,
  createSbtpgClearanceStore,
  evaluatePaymentGate,
  REFUND_ADVANCE_PRODUCTS,
  SBTPG_PROVIDER,
  createSbtpgAdapter
} from '../../../packages/bank-products/src/index.mjs';
import { servePublicOrShared, sendNotFoundPage, sendDesignSystemPage } from '../../../packages/ui-system/src/serve.mjs';
import { buildOperationalSeed, loadFirmIdentity, resolveServiceWiring } from '../../../packages/operational-seed/src/index.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3004;

export const enrollmentDescriptor = createServiceDescriptor({
  name: 'enrollment-service',
  domain: 'bank-products',
  responsibilities: [
    'Expose SBTPG refund advance / refund transfer products and disclosures.',
    'Provide the taxpayer enrollment interface and REST API.',
    'Validate SBTPG operator logins, issue clearance tokens, and audit every attempt.',
    'Enforce the fail-safe payment gate before any funding is permitted.'
  ],
  dependencies: ['@rtp/bank-products']
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
      if (size > 200_000) {
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
  if (urlPath === '/design-system') {
    return sendDesignSystemPage(response, { serviceName: 'Enrollment', homeHref: '/' });
  }
  if (await servePublicOrShared(response, urlPath, publicDir)) return;
  const looksHtml = !path.extname(urlPath) || urlPath.endsWith('.html');
  if (looksHtml) return sendNotFoundPage(response);
  sendJson(response, 404, { error: 'not_found', path: urlPath });
}

function clientMeta(request) {
  return {
    source: 'enrollment-ui',
    ip: request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || request.socket?.remoteAddress || null,
    userAgent: request.headers['user-agent'] ?? null
  };
}

function bearerToken(request, url) {
  const header = request.headers.authorization ?? '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return url.searchParams.get('token') || request.headers['x-sbtpg-clearance'] || null;
}

export function createEnrollmentServer() {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const enrollments = [];
  const clearance = createSbtpgClearanceStore();
  const firm = loadFirmIdentity();
  const operational = buildOperationalSeed();
  const wiring = resolveServiceWiring();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { status: 'ok', service: enrollmentDescriptor.name, environment: config.appEnv });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: enrollmentDescriptor,
          runtime: redactConfig(config),
          provider: SBTPG_PROVIDER,
          adapter: createSbtpgAdapter(),
          environmentProtection: evaluateEnvironmentProtection(config),
          credentials: clearance.credentialsStatus(),
          metadata: {
            products: REFUND_ADVANCE_PRODUCTS.length,
            enrollments: enrollments.length,
            auditEntries: clearance.listAudit({ limit: 1000 }).length,
            firm: {
              company: firm.company,
              operator: firm.operator?.name ?? null,
              completeness: firm.completeness
            },
            wiring: {
              refund: wiring.byId['refund-status-service']?.baseUrl,
              posCrm: wiring.byId['pos-crm-service']?.baseUrl
            },
            bankProducts: operational.catalogs.counts.bankProducts
          }
        });
      }

      if (request.method === 'GET' && pathname === '/api/operational') {
        return sendJson(response, 200, {
          firm,
          catalogs: operational.catalogs,
          wiring: wiring.services
        });
      }

      if (request.method === 'GET' && pathname === '/api/products') {
        return sendJson(response, 200, { provider: SBTPG_PROVIDER, products: REFUND_ADVANCE_PRODUCTS });
      }

      if (request.method === 'GET' && pathname === '/api/auth/status') {
        return sendJson(response, 200, {
          credentials: clearance.credentialsStatus(),
          clearance: clearance.evaluateClearance(bearerToken(request, url))
        });
      }

      if (request.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readBody(request);
        const result = await clearance.login({
          username: body.username,
          secret: body.secret ?? body.password,
          meta: clientMeta(request)
        });
        if (!result.cleared) {
          return sendJson(response, 401, {
            error: 'login_rejected',
            code: result.error.code,
            message: result.error.message,
            auditId: result.auditId
          });
        }
        return sendJson(response, 200, {
          cleared: true,
          clearance: result.clearance,
          auditId: result.auditId,
          message: 'SBTPG login validated — clearance issued.'
        });
      }

      if (request.method === 'POST' && pathname === '/api/auth/logout') {
        const body = await readBody(request);
        const token = body.token || bearerToken(request, url);
        const result = await clearance.logout(token, clientMeta(request));
        return sendJson(response, 200, result);
      }

      if (request.method === 'GET' && pathname === '/api/auth/clearance') {
        return sendJson(response, 200, clearance.evaluateClearance(bearerToken(request, url)));
      }

      if (request.method === 'GET' && pathname === '/api/auth/audit') {
        const limit = Math.min(200, Number(url.searchParams.get('limit')) || 50);
        const persisted = url.searchParams.get('persisted') === '1';
        const entries = persisted ? await clearance.readPersistedAudit({ limit }) : clearance.listAudit({ limit });
        return sendJson(response, 200, { count: entries.length, auditPath: clearance.auditPath, entries });
      }

      if (request.method === 'GET' && pathname === '/api/payment-gate') {
        return sendJson(response, 200, evaluatePaymentGate({
          config,
          clearanceToken: bearerToken(request, url),
          clearanceStore: clearance
        }));
      }

      if (request.method === 'GET' && pathname === '/api/enrollments') {
        return sendJson(response, 200, { count: enrollments.length, enrollments });
      }

      const detail = pathname.match(/^\/api\/enrollments\/([^/]+)$/);
      if (request.method === 'GET' && detail) {
        const record = enrollments.find((e) => e.id === decodeURIComponent(detail[1]));
        if (!record) return sendJson(response, 404, { error: 'enrollment_not_found', id: detail[1] });
        return sendJson(response, 200, { enrollment: record });
      }

      if (request.method === 'POST' && pathname === '/api/enrollments') {
        const body = await readBody(request);
        try {
          const record = createEnrollment(body, { config });
          enrollments.unshift(record);
          if (enrollments.length > 200) enrollments.length = 200;
          return sendJson(response, 201, { enrollment: record });
        } catch (error) {
          return sendJson(response, 400, { error: 'invalid_enrollment', message: error.message });
        }
      }

      if (request.method === 'GET') return serveStatic(response, pathname);

      sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
    } catch (error) {
      sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });

  return { server, config, enrollments, clearance };
}

export function start() {
  const context = createEnrollmentServer();
  context.server.listen(context.config.servicePort, () => {
    console.log(`enrollment-service listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`);
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
