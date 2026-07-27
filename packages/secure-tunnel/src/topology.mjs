/**
 * RTPSC actual platform topology — every HTTP service, worker, pipeline, and
 * approved external endpoint the secure tunnel may target.
 *
 * Live IRS/MeF calls still require production gates + provisioned secrets.
 */

export const SERVICE_TOPOLOGY = Object.freeze([
  { id: 'api-gateway', kind: 'gateway', port: 3000, baseUrl: 'http://127.0.0.1:3000', routes: ['/health', '/metadata', '/api/clients', '/api/auth/token', '/api/refund/*'] },
  { id: 'refund-status-service', kind: 'service', port: 3001, baseUrl: 'http://127.0.0.1:3001', routes: ['/health', '/metadata', '/api/cases', '/api/events', '/api/refunds/full'] },
  { id: 'transcript-service', kind: 'service', port: 3002, baseUrl: 'http://127.0.0.1:3002', routes: ['/health', '/metadata'] },
  { id: 'analytics-service', kind: 'service', port: 3003, baseUrl: 'http://127.0.0.1:3003', routes: ['/health', '/metadata'] },
  { id: 'enrollment-service', kind: 'service', port: 3004, baseUrl: 'http://127.0.0.1:3004', routes: ['/health', '/metadata', '/api/enrollments', '/api/auth/*'] },
  { id: 'invoice-service', kind: 'service', port: 3005, baseUrl: 'http://127.0.0.1:3005', routes: ['/health', '/metadata', '/api/invoices', '/api/catalog'] },
  { id: 'pos-crm-service', kind: 'service', port: 3006, baseUrl: 'http://127.0.0.1:3006', routes: ['/health', '/metadata', '/api/contacts', '/api/pos/*'] },
  { id: 'modules-dashboard', kind: 'service', port: 3010, baseUrl: 'http://127.0.0.1:3010', routes: ['/health', '/metadata', '/api/modules', '/api/status'] },
  { id: 'ross-ai-runtime', kind: 'control-plane', port: 8787, baseUrl: 'http://127.0.0.1:8787', routes: ['/', '/signin', '/dashboard', '/api/*'] },
  { id: 'irs-gateway', kind: 'gateway', port: 8820, baseUrl: 'http://127.0.0.1:8820', routes: ['/health', '/metadata', '/irs/token'] },
  { id: 'ai-workforce-hub', kind: 'service', port: 8860, baseUrl: 'http://127.0.0.1:8860', routes: ['/health', '/metadata', '/v1/*'] },
  { id: 'apple-developer-console', kind: 'integration', port: 8870, baseUrl: 'http://127.0.0.1:8870', routes: ['/health', '/metadata', '/api/apple/*'] }
]);

export const WORKER_TOPOLOGY = Object.freeze([
  { id: 'tds-worker', kind: 'worker', entry: 'workers/tds-worker/src/index.mjs', channel: 'approved-tds' },
  { id: 'transcript-pull-worker', kind: 'worker', entry: 'workers/transcript-pull-worker/src/index.mjs', channel: 'approved-transcript' },
  { id: 'live-source-fetcher', kind: 'worker', entry: 'workers/live-source-fetcher/src/index.mjs', channel: 'approved-live-source' },
  { id: 'workflow-runner', kind: 'worker', entry: 'workers/workflow-runner/src/index.mjs', channel: 'internal-workflows' },
  { id: 'ai-persona-worker', kind: 'worker', entry: 'workers/ai-persona-worker/src/index.mjs', channel: 'internal-ai' }
]);

export const PIPELINE_TOPOLOGY = Object.freeze([
  { id: 'transmission-pipeline', stages: ['prepare', 'validate', 'queue', 'transmit', 'acknowledge'], transmitter: true },
  { id: 'masterfile-pipeline', stages: ['ingest-approved-record', 'normalize-masterfile', 'enrich-tax-indicators', 'publish-canonical-event'], transmitter: false },
  { id: 'refund-status-pipeline', stages: ['ingest-approved-event', 'deduplicate', 'update-status-timeline', 'trigger-escalation-rules'], transmitter: false }
]);

/**
 * Hosts the secure tunnel is allowed to dial. Only HTTPS IRS / Apple / explicit
 * approved tunnel hosts. Scraping hosts are never allowlisted.
 */
export const APPROVED_EXTERNAL_ALLOWLIST = Object.freeze([
  {
    id: 'irs-oauth',
    url: 'https://api.irs.gov/oauth2/v1/token',
    purpose: 'IRS OAuth2 client-credentials token',
    channel: 'irs-gateway'
  },
  {
    id: 'irs-api-root',
    url: 'https://api.irs.gov/',
    purpose: 'IRS API root (TDS / approved APIs only)',
    channel: 'approved-irs-tunnel'
  },
  {
    id: 'apple-asc-api',
    url: 'https://api.appstoreconnect.apple.com/v1',
    purpose: 'App Store Connect API',
    channel: 'apple-connect'
  },
  {
    id: 'apple-developer',
    url: 'https://developer.apple.com/',
    purpose: 'Apple Developer portal (operator links)',
    channel: 'apple-connect'
  }
]);

export function topologySummary() {
  return {
    services: SERVICE_TOPOLOGY.length,
    workers: WORKER_TOPOLOGY.length,
    pipelines: PIPELINE_TOPOLOGY.length,
    approvedExternal: APPROVED_EXTERNAL_ALLOWLIST.length,
    transmitters: PIPELINE_TOPOLOGY.filter((p) => p.transmitter).map((p) => p.id)
  };
}
