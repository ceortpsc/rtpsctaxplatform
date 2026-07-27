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
import { createPractitionerSuite } from '../../../packages/irs-practitioner/src/index.mjs';
import { servePublicOrShared, sendNotFoundPage, sendDesignSystemPage } from '../../../packages/ui-system/src/serve.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 8880;

export const irsPractitionerDescriptor = createServiceDescriptor({
  name: 'irs-practitioner-service',
  domain: 'tax-practitioner',
  responsibilities: [
    'Expose the IRS Tax Practitioner / ERO suite account interface.',
    'Integrate API, TDS, and IRS OAuth client posture for practitioners.',
    'Drive TC 570/810 masterfile rectification, refund release, and reconciliation.',
    'Serve custom XHTML/XML practitioner payloads and AI assist guidance.'
  ],
  dependencies: [
    '@rtp/irs-practitioner',
    '@rtp/irs-xml',
    '@rtp/refund-release-core',
    'tc-code-engine',
    'masterfile-pipeline',
    'refund-intelligence-engine',
    '@rtp/ai-assist',
    '@rtp/client-identity'
  ]
});

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}

function sendText(response, statusCode, body, contentType, filename) {
  response.writeHead(statusCode, {
    'content-type': contentType,
    ...(filename
      ? { 'content-disposition': `attachment; filename="${filename}"` }
      : {})
  });
  response.end(body);
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
  if (urlPath === '/design-system') {
    return sendDesignSystemPage(response, { serviceName: 'Tax Practitioner Suite', homeHref: '/' });
  }
  if (await servePublicOrShared(response, urlPath, publicDir)) return;
  const looksHtml = !path.extname(urlPath) || urlPath.endsWith('.html');
  if (looksHtml) return sendNotFoundPage(response);
  sendJson(response, 404, { error: 'not_found', path: urlPath });
}

export function createIrsPractitionerServer({ suite } = {}) {
  const config = loadRuntimeConfig({ servicePort: Number(process.env.SERVICE_PORT || DEFAULT_PORT) });
  const practitioner = suite ?? createPractitionerSuite();
  let ready = false;

  async function ensure() {
    if (ready) return;
    await practitioner.ensureClients();
    ready = true;
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      await ensure();

      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, {
          status: 'ok',
          service: irsPractitionerDescriptor.name,
          environment: config.appEnv
        });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: irsPractitionerDescriptor,
          runtime: redactConfig(config),
          environmentProtection: evaluateEnvironmentProtection(config),
          suite: practitioner.describe(),
          metadata: {
            releases: practitioner.releases.snapshot(),
            integrations: practitioner.integrations.interfaces.map((i) => ({
              id: i.id,
              title: i.title,
              ready:
                i.id === 'irs-oauth'
                  ? i.clientIdConfigured && i.keyConfigured
                  : i.clientIdConfigured
            }))
          }
        });
      }

      if (request.method === 'GET' && pathname === '/api/account') {
        return sendJson(response, 200, practitioner.accountInterface());
      }

      if (request.method === 'GET' && pathname === '/api/integrations') {
        return sendJson(response, 200, practitioner.integrations);
      }

      if (request.method === 'GET' && pathname === '/api/clients') {
        return sendJson(response, 200, practitioner.clients.status());
      }

      if (request.method === 'GET' && pathname === '/api/tc-catalog') {
        const account = practitioner.accountInterface();
        return sendJson(response, 200, { catalog: account.tcCatalog, holdCodes: account.holdCodes });
      }

      if (request.method === 'POST' && pathname === '/api/masterfile/process') {
        const body = await readBody(request);
        return sendJson(response, 200, practitioner.runMasterfileCycle(body));
      }

      if (request.method === 'POST' && pathname === '/api/assist') {
        const body = await readBody(request);
        return sendJson(response, 200, { assist: practitioner.assistRefundRelease(body.prompt || body.text) });
      }

      if (request.method === 'POST' && pathname === '/api/intelligence') {
        const body = await readBody(request);
        return sendJson(response, 200, { intelligence: practitioner.intelligenceForCase(body) });
      }

      if (request.method === 'POST' && pathname === '/api/release/lifecycle') {
        const body = await readBody(request);
        const result = practitioner.executeRefundReleaseLifecycle(body);
        return sendJson(response, 201, result);
      }

      if (request.method === 'GET' && pathname === '/api/releases') {
        return sendJson(response, 200, { releases: practitioner.releases.listRequests() });
      }

      if (request.method === 'GET' && pathname === '/api/reconciliations') {
        return sendJson(response, 200, { reconciliations: practitioner.releases.listReconciliations() });
      }

      if (request.method === 'GET' && pathname === '/api/account.xml') {
        const account = practitioner.accountInterface();
        return sendText(response, 200, account.xml, 'application/xml; charset=utf-8', 'practitioner-account.xml');
      }

      if (request.method === 'GET' && pathname === '/api/suite.xhtml') {
        const account = practitioner.accountInterface();
        return sendText(response, 200, account.xhtml, 'application/xhtml+xml; charset=utf-8', 'practitioner-suite.xhtml');
      }

      const releaseXml = pathname.match(/^\/api\/releases\/([^/]+)\/xml$/);
      if (request.method === 'GET' && releaseXml) {
        const id = decodeURIComponent(releaseXml[1]);
        const release = practitioner.releases.findRequest(id);
        if (!release) return sendJson(response, 404, { error: 'release_not_found', id });
        return sendText(response, 200, release.xml, 'application/xml; charset=utf-8', `${id}.xml`);
      }

      if (request.method === 'GET') return serveStatic(response, pathname);
      sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
    } catch (error) {
      const status = error.code === 'release_blocked' ? 409 : 400;
      sendJson(response, status, {
        error: error.code || 'bad_request',
        message: error.message,
        gate: error.gate || undefined
      });
    }
  });

  return { server, config, practitioner };
}

export function start() {
  const context = createIrsPractitionerServer();
  const port = context.config.servicePort || DEFAULT_PORT;
  context.server.listen(port, async () => {
    await context.practitioner.ensureClients();
    console.log(`irs-practitioner-service listening on http://localhost:${port} (${context.config.appEnv})`);
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
