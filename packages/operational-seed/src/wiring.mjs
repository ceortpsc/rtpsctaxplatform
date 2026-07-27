import {
  SERVICE_TOPOLOGY,
  WORKER_TOPOLOGY,
  PIPELINE_TOPOLOGY,
  APPROVED_EXTERNAL_ALLOWLIST,
  topologySummary
} from '../../secure-tunnel/src/topology.mjs';

const ENV_URL_KEYS = Object.freeze({
  'api-gateway': 'API_GATEWAY_URL',
  'refund-status-service': 'REFUND_STATUS_URL',
  'transcript-service': 'TRANSCRIPT_SERVICE_URL',
  'analytics-service': 'ANALYTICS_SERVICE_URL',
  'enrollment-service': 'ENROLLMENT_SERVICE_URL',
  'invoice-service': 'INVOICE_SERVICE_URL',
  'pos-crm-service': 'POS_CRM_SERVICE_URL',
  'modules-dashboard': 'MODULES_DASHBOARD_URL',
  'ross-ai-runtime': 'ROSS_AI_URL',
  'irs-gateway': 'IRS_GATEWAY_URL',
  'ai-workforce-hub': 'AI_WORKFORCE_URL',
  'apple-developer-console': 'APPLE_CONSOLE_URL'
});

/** Resolve service base URLs from topology with optional env overrides. */
export function resolveServiceWiring(env = process.env) {
  const services = SERVICE_TOPOLOGY.map((entry) => {
    const envKey = ENV_URL_KEYS[entry.id];
    const fromEnv = envKey ? String(env[envKey] ?? '').trim() : '';
    const baseUrl = fromEnv || entry.baseUrl;
    return {
      id: entry.id,
      kind: entry.kind,
      port: entry.port,
      envKey: envKey ?? null,
      baseUrl,
      routes: [...(entry.routes ?? [])],
      wiredFrom: fromEnv ? 'env' : 'topology'
    };
  });

  const byId = Object.fromEntries(services.map((s) => [s.id, s]));

  const edges = [
    { from: 'api-gateway', to: 'refund-status-service', purpose: 'proxy refund routes', path: '/api/refund/*' },
    { from: 'pos-crm-service', to: 'invoice-service', purpose: 'shared invoice-core catalog + checkout settlement', path: 'library' },
    { from: 'enrollment-service', to: 'refund-status-service', purpose: 'bank-product enrollment ↔ refund case linkage', path: 'operational' },
    { from: 'irs-gateway', to: 'approved-external:irs-oauth', purpose: 'IRS OAuth token', path: '/irs/token' },
    { from: 'apple-developer-console', to: 'approved-external:apple-asc-api', purpose: 'App Store Connect API', path: '/api/apple/*' },
    { from: 'modules-dashboard', to: 'api-gateway', purpose: 'live status probes', path: '/health' },
    { from: 'tds-worker', to: 'refund-status-service', purpose: 'approved TDS ingest', path: '/api/events' },
    { from: 'transcript-pull-worker', to: 'transcript-service', purpose: 'approved transcript pull', path: 'worker' },
    { from: 'workflow-runner', to: 'transmission-pipeline', purpose: 'background transmission workflow', path: 'workflow' }
  ];

  return {
    summary: topologySummary(),
    services,
    byId,
    workers: WORKER_TOPOLOGY.map((w) => ({ ...w })),
    pipelines: PIPELINE_TOPOLOGY.map((p) => ({ ...p })),
    approvedExternal: APPROVED_EXTERNAL_ALLOWLIST.map((e) => ({ ...e })),
    edges,
    envUrlKeys: { ...ENV_URL_KEYS }
  };
}

export function serviceBaseUrl(serviceId, env = process.env) {
  const wiring = resolveServiceWiring(env);
  return wiring.byId[serviceId]?.baseUrl ?? null;
}
