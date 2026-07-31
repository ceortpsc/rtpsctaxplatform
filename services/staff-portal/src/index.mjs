import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createServiceDescriptor,
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  redactConfig,
  sendJson
} from '../../../packages/platform-core/src/index.mjs';
import {
  serveDesignSystemAsset,
  getNavJson,
  filterNavByRole,
  NAV_SECTIONS
} from '../../../packages/ui-design-system/src/index.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3012;

export const staffPortalDescriptor = createServiceDescriptor({
  name: 'staff-portal',
  domain: 'operations',
  responsibilities: [
    'Unified staff application shell with role-aware navigation.',
    'Executive operations dashboard and design-system showcase.',
    'Cross-module navigation hub for RTPSC operator workspaces.'
  ],
  dependencies: ['@rtp/ui-design-system', '@rtp/platform-core']
});

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

async function serveStatic(response, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.join(publicDir, relative);
  if (!resolved.startsWith(publicDir)) return sendJson(response, 403, { error: 'forbidden' });
  try {
    const file = await readFile(resolved);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(resolved)] ?? 'application/octet-stream' });
    response.end(file);
  } catch {
    if (urlPath === '/design-system') {
      return serveStatic(response, '/design-system.html');
    }
    sendJson(response, 404, { error: 'not_found', path: urlPath });
  }
}

function dashboardMetrics() {
  return {
    asOf: new Date().toISOString(),
    widgets: [
      { id: 'invoices', label: 'Outstanding invoices', value: '—', status: 'limited', href: 'http://localhost:3005' },
      { id: 'approvals', label: 'Pending approvals', value: '—', status: 'limited' },
      { id: 'refunds', label: 'Refund cases', value: '—', status: 'ready', href: 'http://localhost:3001' },
      { id: 'transmission', label: 'E-file transmission', value: 'BLOCKED', status: 'blocked_credentials' }
    ]
  };
}

export function createStaffPortalServer() {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { status: 'ok', service: staffPortalDescriptor.name, environment: config.appEnv });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: staffPortalDescriptor,
          runtime: redactConfig(config),
          environmentProtection: evaluateEnvironmentProtection(config),
          metadata: { shell: 'sovereign-ledger', navSections: NAV_SECTIONS.length }
        });
      }

      if (request.method === 'GET' && pathname === '/api/navigation') {
        const role = url.searchParams.get('role') ?? 'tax_preparer';
        const filtered = NAV_SECTIONS.map((section) => ({
          ...section,
          items: filterNavByRole(section.items, role)
        }));
        return sendJson(response, 200, { ...getNavJson(role), sections: filtered });
      }

      if (request.method === 'GET' && pathname === '/api/dashboard') {
        return sendJson(response, 200, dashboardMetrics());
      }

      if (serveDesignSystemAsset(response, pathname)) return;

      if (request.method === 'GET') return serveStatic(response, pathname);

      sendJson(response, 405, { error: 'method_not_allowed' });
    } catch (error) {
      sendJson(response, 500, { error: 'internal_error', message: error.message });
    }
  });

  return { server, config };
}

export function start() {
  const { server, config } = createStaffPortalServer();
  server.listen(config.servicePort, () => {
    console.log(`staff-portal listening on http://localhost:${config.servicePort} (${config.appEnv})`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
