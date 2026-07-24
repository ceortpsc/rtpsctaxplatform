import http from 'node:http';

// Product identity for Ross Tax Pro Software Co (RTPSC).
export const PLATFORM_IDENTITY = Object.freeze({
  company: 'Ross Tax Pro Software Co',
  application: 'Efile Transmission Software',
  abbreviation: 'RTPSC'
});

const defaultComplianceNotice = [
  'No unauthorized access to IRS systems.',
  'No scraping-based refund status collection.',
  'Secrets must come from environment configuration.'
];

const PRODUCTION_ENVIRONMENTS = new Set(['prod', 'production']);

export function loadRuntimeConfig(overrides = {}) {
  const appEnv = overrides.appEnv ?? process.env.APP_ENV ?? 'local';
  const servicePort = Number(overrides.servicePort ?? process.env.SERVICE_PORT ?? 3000);

  return {
    appEnv,
    nodeEnv: overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development',
    servicePort,
    apiClientId: overrides.apiClientId ?? process.env.API_CLIENT_ID ?? 'unset',
    apiClientSecret: overrides.apiClientSecret ?? process.env.API_CLIENT_SECRET ?? 'unset',
    tdsClientId: overrides.tdsClientId ?? process.env.TDS_CLIENT_ID ?? 'unset',
    tdsClientSecret: overrides.tdsClientSecret ?? process.env.TDS_CLIENT_SECRET ?? 'unset',
    tunnelClientId: overrides.tunnelClientId ?? process.env.TUNNEL_CLIENT_ID ?? 'unset',
    tunnelClientSecret: overrides.tunnelClientSecret ?? process.env.TUNNEL_CLIENT_SECRET ?? 'unset',
    approvedTunnelEndpoint: overrides.approvedTunnelEndpoint ?? process.env.APPROVED_TUNNEL_ENDPOINT ?? 'unset',
    efileTransmissionEnabled:
      overrides.efileTransmissionEnabled ?? process.env.EFILE_TRANSMISSION_ENABLED === 'true'
  };
}

export function redactConfig(config) {
  return {
    appEnv: config.appEnv,
    nodeEnv: config.nodeEnv,
    servicePort: config.servicePort,
    apiClientId: config.apiClientId,
    tdsClientId: config.tdsClientId,
    tunnelClientId: config.tunnelClientId,
    approvedTunnelEndpoint: config.approvedTunnelEndpoint,
    efileTransmissionEnabled: config.efileTransmissionEnabled === true,
    secretsConfigured: [config.apiClientSecret, config.tdsClientSecret, config.tunnelClientSecret].every((value) => value !== 'unset')
  };
}

/**
 * Environment protection guard for the Efile Transmission Software.
 *
 * Live IRS e-file transmission is a high-risk operation. This guard fails safe:
 * transmission stays BLOCKED unless every safeguard passes — the environment is
 * production, all credentials are configured, an approved secure tunnel endpoint
 * is set, and EFILE_TRANSMISSION_ENABLED is explicitly "true".
 */
export function evaluateEnvironmentProtection(config = loadRuntimeConfig()) {
  const appEnv = config.appEnv;
  const isProduction = PRODUCTION_ENVIRONMENTS.has(appEnv);
  const secretsConfigured = [config.apiClientSecret, config.tdsClientSecret, config.tunnelClientSecret].every(
    (value) => value && value !== 'unset'
  );
  const approvedTunnel = Boolean(config.approvedTunnelEndpoint) && config.approvedTunnelEndpoint !== 'unset';
  const transmissionFlagEnabled = config.efileTransmissionEnabled === true;

  const reasons = [];
  if (!isProduction) reasons.push(`Environment "${appEnv}" is not a production environment.`);
  if (!secretsConfigured) reasons.push('API/TDS/tunnel secrets are not fully configured.');
  if (!approvedTunnel) reasons.push('No approved secure tunnel endpoint is configured.');
  if (!transmissionFlagEnabled) reasons.push('EFILE_TRANSMISSION_ENABLED is not set to "true".');

  const transmissionAllowed = reasons.length === 0;
  return Object.freeze({
    company: PLATFORM_IDENTITY.company,
    application: PLATFORM_IDENTITY.application,
    appEnv,
    environment: isProduction ? 'production' : appEnv,
    protected: !transmissionAllowed,
    transmissionAllowed,
    safeguards: {
      productionEnvironment: isProduction,
      secretsConfigured,
      approvedTunnel,
      transmissionFlagEnabled
    },
    reasons,
    checkedAt: new Date().toISOString()
  });
}

export function createServiceDescriptor({ name, domain, responsibilities = [], dependencies = [] }) {
  return Object.freeze({ name, domain, responsibilities, dependencies, compliance: defaultComplianceNotice });
}

export function createWorkerDescriptor({ name, responsibilities = [], schedule = 'always-on', mode = 'long-running' }) {
  return Object.freeze({ name, responsibilities, schedule, mode, compliance: defaultComplianceNotice });
}

export function createPipelineDescriptor({ name, stages = [], outputs = [] }) {
  return Object.freeze({ name, stages, outputs, compliance: defaultComplianceNotice });
}

export function createEngineDescriptor({ name, capabilities = [], outputs = [] }) {
  return Object.freeze({ name, capabilities, outputs, compliance: defaultComplianceNotice });
}

export function startHttpService({ descriptor, defaultPort = 3000, extraMetadata = {} }) {
  const config = loadRuntimeConfig({ servicePort: defaultPort });
  const payload = {
    identity: PLATFORM_IDENTITY,
    service: descriptor,
    runtime: redactConfig(config),
    environmentProtection: evaluateEnvironmentProtection(config),
    metadata: extraMetadata
  };

  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json; charset=utf-8');

    if (request.url === '/health') {
      response.writeHead(200);
      response.end(JSON.stringify({ status: 'ok', service: descriptor.name, environment: config.appEnv }));
      return;
    }

    if (request.url === '/metadata') {
      response.writeHead(200);
      response.end(JSON.stringify(payload, null, 2));
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: 'not_found', service: descriptor.name }));
  });

  server.listen(config.servicePort);
  return { server, config, payload };
}

export function runWorker({ descriptor, steps = [] }) {
  const config = loadRuntimeConfig();
  const output = {
    worker: descriptor,
    runtime: redactConfig(config),
    steps
  };

  if (process.argv.includes('--once')) {
    console.log(JSON.stringify(output, null, 2));
    return output;
  }

  console.log(`${descriptor.name} started in ${config.appEnv} mode. Press Ctrl+C to stop.`);
  const timer = setInterval(() => {
    console.log(JSON.stringify({ heartbeat: descriptor.name, environment: config.appEnv }));
  }, 15000);
  timer.unref();

  const stop = () => clearInterval(timer);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  return { timer, output, stop };
}
