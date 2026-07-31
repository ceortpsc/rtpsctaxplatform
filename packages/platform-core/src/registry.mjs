/**
 * Canonical platform surface registry — services, ports, pages, API routes, engines.
 * Single source of truth for deploy/start/CLI/dashboard alignment.
 */

export const PLATFORM_SERVICES = Object.freeze([
  {
    id: 'api-gateway',
    name: 'api-gateway',
    port: 3000,
    entry: 'services/api-gateway/src/index.mjs',
    aliases: ['gateway'],
    pages: [],
    routes: [
      'GET /health',
      'GET /metadata',
      'GET /api/clients',
      'POST /api/auth/token',
      'GET /api/refund',
      'GET /api/refund/*',
      'POST /api/refund/*'
    ]
  },
  {
    id: 'refund-status',
    name: 'refund-status-service',
    port: 3001,
    entry: 'services/refund-status-service/src/index.mjs',
    aliases: ['refund-status'],
    pages: ['/'],
    routes: [
      'GET /',
      'GET /health',
      'GET /metadata',
      'GET /api/catalog',
      'GET /api/clients',
      'GET /api/cases',
      'GET /api/cases/:id',
      'GET /api/cases/:id/timeline',
      'GET /api/events',
      'POST /api/events',
      'POST /api/refunds/full'
    ]
  },
  {
    id: 'transcript',
    name: 'transcript-service',
    port: 3002,
    entry: 'services/transcript-service/src/index.mjs',
    aliases: ['transcript'],
    pages: [],
    routes: [
      'GET /health',
      'GET /metadata',
      'GET /api/catalog',
      'GET /api/pulls',
      'POST /api/pulls'
    ]
  },
  {
    id: 'analytics',
    name: 'analytics-service',
    port: 3003,
    entry: 'services/analytics-service/src/index.mjs',
    aliases: ['analytics'],
    pages: [],
    routes: [
      'GET /health',
      'GET /metadata',
      'GET /api/feed',
      'GET /api/metrics',
      'GET /api/tc-codes',
      'POST /api/aggregate',
      'POST /api/tc-codes/enrich'
    ]
  },
  {
    id: 'enrollment',
    name: 'enrollment-service',
    port: 3004,
    entry: 'services/enrollment-service/src/index.mjs',
    aliases: ['enrollment'],
    pages: ['/'],
    routes: [
      'GET /',
      'GET /health',
      'GET /metadata',
      'GET /api/products',
      'GET /api/auth/status',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'GET /api/auth/clearance',
      'GET /api/auth/audit',
      'GET /api/payment-gate',
      'GET /api/enrollments',
      'POST /api/enrollments',
      'GET /api/enrollments/:id'
    ]
  },
  {
    id: 'invoice',
    name: 'invoice-service',
    port: 3005,
    entry: 'services/invoice-service/src/index.mjs',
    aliases: ['invoice'],
    pages: ['/'],
    routes: [
      'GET /',
      'GET /health',
      'GET /metadata',
      'GET /api/catalog',
      'GET /api/tax',
      'POST /api/assist',
      'GET /api/invoices',
      'POST /api/invoices',
      'POST /api/invoices/:id/submit',
      'POST /api/invoices/:id/approve',
      'POST /api/invoices/:id/pay',
      'GET /api/invoices/:id/pdf',
      'GET /api/invoices/:id/receipt.pdf',
      'GET /api/invoices/:id/receipt.txt'
    ]
  },
  {
    id: 'pos-crm',
    name: 'pos-crm-service',
    port: 3006,
    entry: 'services/pos-crm-service/src/index.mjs',
    aliases: ['pos-crm', 'pos', 'crm'],
    pages: ['/'],
    routes: [
      'GET /',
      'GET /health',
      'GET /metadata',
      'GET /api/tax',
      'GET /api/catalog',
      'GET /api/contacts',
      'POST /api/contacts',
      'GET /api/accounts',
      'GET /api/pos/sessions',
      'POST /api/pos/sessions',
      'GET /api/pos/sales',
      'GET /api/ero/phrases',
      'POST /api/ero/phrases',
      'POST /api/ero/intelligence',
      'GET /api/sbtpg/traces',
      'POST /api/sbtpg/traces'
    ]
  },
  {
    id: 'dashboard',
    name: 'modules-dashboard',
    port: 3010,
    entry: 'services/modules-dashboard/src/index.mjs',
    aliases: ['dashboard', 'modules-dashboard'],
    pages: ['/'],
    routes: [
      'GET /',
      'GET /health',
      'GET /metadata',
      'GET /api/environment',
      'GET /api/modules',
      'GET /api/insights',
      'GET /api/graph',
      'GET /api/status',
      'GET /api/routes',
      'GET /api/release',
      'POST /api/assistant'
    ]
  },
  {
    id: 'web-portal',
    name: 'web-portal',
    port: 3011,
    entry: 'services/web-portal/src/index.mjs',
    aliases: ['web-portal', 'portal', 'web'],
    pages: ['/'],
    routes: ['GET /', 'GET /health', 'GET /metadata']
  },
  {
    id: 'staff-portal',
    name: 'staff-portal',
    port: 3012,
    entry: 'services/staff-portal/src/index.mjs',
    aliases: ['staff-portal', 'staff'],
    pages: ['/'],
    routes: ['GET /', 'GET /health', 'GET /metadata']
  },
  {
    id: 'irs-gateway',
    name: 'irs-gateway',
    port: 8820,
    entry: 'services/irs-gateway/src/index.mjs',
    aliases: ['irs-gateway', 'irs'],
    pages: [],
    routes: ['GET /health', 'GET /metadata', 'POST /irs/token']
  },
  {
    id: 'ai-workforce',
    name: 'ai-workforce-hub',
    port: 8860,
    entry: 'services/ai-workforce-hub/src/index.mjs',
    aliases: ['ai-workforce', 'ai-workforce-hub'],
    pages: ['/'],
    routes: [
      'GET /',
      'GET /health',
      'GET /metadata',
      'GET /v1/governance',
      'GET /v1/personas',
      'GET /v1/catalog',
      'GET /v1/tasks',
      'GET /v1/events',
      'GET /v1/runtime',
      'POST /v1/hire',
      'POST /v1/tasks/authenticate',
      'POST /v1/tasks/scope',
      'POST /v1/tasks/price',
      'POST /v1/tasks/pay',
      'POST /v1/tasks/queue',
      'POST /v1/tasks/run',
      'POST /v1/tasks/human-approve',
      'POST /v1/tasks/hold',
      'POST /v1/live-service'
    ]
  }
]);

export const PLATFORM_ENGINES = Object.freeze([
  {
    id: 'refund-intelligence-engine',
    entry: 'engines/refund-intelligence-engine/src/index.mjs',
    status: 'operational'
  },
  {
    id: 'refund-optimization-engine',
    entry: 'engines/refund-optimization-engine/src/index.mjs',
    status: 'operational'
  },
  {
    id: 'ai-persona-runtime',
    entry: 'engines/ai-persona-runtime/src/index.mjs',
    status: 'operational'
  },
  {
    id: 'analytics-center',
    entry: 'engines/analytics-center/src/index.mjs',
    status: 'operational'
  },
  {
    id: 'tc-code-engine',
    entry: 'engines/tc-code-engine/src/index.mjs',
    status: 'operational'
  },
  {
    id: 'pdf-fill-engine',
    entry: 'engines/pdf-fill-engine/src/index.mjs',
    status: 'operational'
  }
]);

export function listServiceEndpoints() {
  return PLATFORM_SERVICES.map((service) => ({
    id: service.id,
    name: service.name,
    port: service.port,
    health: `http://127.0.0.1:${service.port}/health`,
    metadata: `http://127.0.0.1:${service.port}/metadata`
  }));
}

export function listPlatformPages() {
  return PLATFORM_SERVICES.flatMap((service) =>
    service.pages.map((page) => ({
      service: service.name,
      port: service.port,
      path: page,
      url: `http://127.0.0.1:${service.port}${page === '/' ? '/' : page}`
    }))
  );
}

export function listPlatformRoutes() {
  return PLATFORM_SERVICES.map((service) => ({
    service: service.name,
    id: service.id,
    port: service.port,
    entry: service.entry,
    pages: service.pages,
    routes: service.routes
  }));
}

export function resolveServiceEntry(alias) {
  const key = String(alias || '').toLowerCase();
  return (
    PLATFORM_SERVICES.find(
      (service) => service.id === key || service.name === key || service.aliases.includes(key)
    ) ?? null
  );
}

export function buildServiceCliMap() {
  const map = {};
  for (const service of PLATFORM_SERVICES) {
    map[service.id] = service.entry;
    map[service.name] = service.entry;
    for (const alias of service.aliases) {
      map[alias] = service.entry;
    }
  }
  return map;
}

export function platformRegistrySummary() {
  const routes = listPlatformRoutes();
  return {
    serviceCount: PLATFORM_SERVICES.length,
    engineCount: PLATFORM_ENGINES.length,
    pageCount: listPlatformPages().length,
    routeCount: routes.reduce((sum, entry) => sum + entry.routes.length, 0),
    ports: PLATFORM_SERVICES.map((s) => s.port)
  };
}
