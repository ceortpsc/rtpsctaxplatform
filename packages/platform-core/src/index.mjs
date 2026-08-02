import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RELEASE_LINE,
  RELEASE_CHANNELS,
  DEFAULT_RELEASE_CHANNEL,
  listReleaseChannels,
  resolveReleaseChannel,
  resolveChannelFromEnv,
  describeReleaseChannel,
  buildReleaseManifest
} from './release-channels.mjs';
import { serveDesignSystemAsset } from '../../ui-design-system/src/static.mjs';

// Product identity for Ross Tax Pro Software Co (RTPSC).
export const PLATFORM_IDENTITY = Object.freeze({
  company: 'Ross Tax Pro Software Co',
  application: 'Efile Transmission Software',
  abbreviation: 'RTPSC',
  version: '02.0V',
  release: 'Ross Tax Pro Software Co 02.0V',
  positioning: 'The hierarchy of enterprise-grade tax pro software',
  grade: 'enterprise',
  market: 'tax-pro-software',
  releaseLine: RELEASE_LINE,
  defaultReleaseChannel: DEFAULT_RELEASE_CHANNEL
});

const defaultComplianceNotice = [
  'No unauthorized access to IRS systems.',
  'No scraping-based refund status collection.',
  'Secrets must come from environment configuration.',
  'AI personas are assistive and cannot clear material HOLD, sign, or transmit without human review.'
];

const PRODUCTION_ENVIRONMENTS = new Set(['prod', 'production']);

export function loadRuntimeConfig(overrides = {}) {
  const appEnv = overrides.appEnv ?? process.env.APP_ENV ?? 'local';
  const servicePort = Number(overrides.servicePort ?? process.env.SERVICE_PORT ?? 3000);
  const releaseChannel = resolveChannelFromEnv(process.env, overrides);

  return {
    appEnv,
    nodeEnv: overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development',
    servicePort,
    releaseChannelId: releaseChannel.id,
    releaseChannelTag: releaseChannel.tag,
    releaseChannel,
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
    releaseChannelId: config.releaseChannelId,
    releaseChannelTag: config.releaseChannelTag,
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
  const channel = config.releaseChannel || resolveChannelFromEnv();

  const reasons = [];
  if (!isProduction) reasons.push(`Environment "${appEnv}" is not a production environment.`);
  if (!secretsConfigured) reasons.push('API/TDS/tunnel secrets are not fully configured.');
  if (!approvedTunnel) reasons.push('No approved secure tunnel endpoint is configured.');
  if (!transmissionFlagEnabled) reasons.push('EFILE_TRANSMISSION_ENABLED is not set to "true".');

  const transmissionAllowed = reasons.length === 0;
  return Object.freeze({
    company: PLATFORM_IDENTITY.company,
    application: PLATFORM_IDENTITY.application,
    version: PLATFORM_IDENTITY.version,
    release: PLATFORM_IDENTITY.release,
    positioning: PLATFORM_IDENTITY.positioning,
    grade: PLATFORM_IDENTITY.grade,
    releaseChannel: {
      id: channel.id,
      tag: channel.tag,
      description: channel.description,
      productionReady: channel.productionReady,
      stability: channel.stability
    },
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

export function readJsonBody(request, { limitBytes = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('request body too large'), { code: 'payload_too_large' }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(Object.assign(error, { code: 'invalid_json' }));
      }
    });
    request.on('error', reject);
  });
}

/** Baseline security headers applied to platform HTTP responses (fail-open if already set). */
export const PLATFORM_SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
});

export function applyPlatformSecurityHeaders(response, extra = {}) {
  for (const [key, value] of Object.entries(PLATFORM_SECURITY_HEADERS)) {
    if (!response.getHeader(key)) response.setHeader(key, value);
  }
  for (const [key, value] of Object.entries(extra)) {
    response.setHeader(key, value);
  }
}

export function sendJson(response, statusCode, body, { securityHeaders = true } = {}) {
  if (securityHeaders) applyPlatformSecurityHeaders(response);
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.writeHead(statusCode);
  response.end(JSON.stringify(body, null, 2));
}

/** Map file extensions to HTTP Content-Type (includes logo/image download formats). */
export function contentTypeFor(filePath) {
  switch (path.extname(String(filePath || '')).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    case '.avif':
      return 'image/avif';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/** True when the request asks for a forced file download (keeps the filename extension). */
export function wantsDownload(requestPathOrUrl) {
  const raw = String(requestPathOrUrl || '');
  const qIndex = raw.indexOf('?');
  if (qIndex === -1) return false;
  const params = new URLSearchParams(raw.slice(qIndex + 1));
  const flag = params.get('download');
  return flag === '' || flag === '1' || flag === 'true' || params.has('attachment');
}

export function contentDispositionFor(filePath, { download = false } = {}) {
  const base = path.basename(filePath);
  // RFC 5987 filename* keeps extensions intact across browsers.
  const encoded = encodeURIComponent(base).replace(/['()]/g, escape);
  const disposition = download ? 'attachment' : 'inline';
  return `${disposition}; filename="${base.replace(/"/g, '')}"; filename*=UTF-8''${encoded}`;
}

export function serveStaticFile(response, rootDir, requestPath, options = {}) {
  let decodedPath;
  const original = String(requestPath || '');
  try {
    decodedPath = decodeURIComponent(original.split('?')[0]);
  } catch {
    sendJson(response, 400, { error: 'bad_request', message: 'Malformed URL encoding' });
    return true;
  }
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const relative = safePath === '/' || safePath === '' ? 'index.html' : safePath.replace(/^\//, '');
  const absolute = path.join(rootDir, relative);
  if (!absolute.startsWith(path.resolve(rootDir))) {
    sendJson(response, 403, { error: 'forbidden' });
    return true;
  }
  if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) return false;
  const download = options.download === true || wantsDownload(original);
  response.setHeader('content-type', contentTypeFor(absolute));
  response.setHeader('content-disposition', contentDispositionFor(absolute, { download }));
  response.writeHead(200);
  fs.createReadStream(absolute).pipe(response);
  return true;
}

export function startHttpService({
  descriptor,
  defaultPort = 3000,
  extraMetadata = {},
  routes = {},
  staticDir = null,
  onReady = null,
  securityHeaders = true
} = {}) {
  const config = loadRuntimeConfig({ servicePort: defaultPort });
  const payload = {
    identity: PLATFORM_IDENTITY,
    service: descriptor,
    runtime: redactConfig(config),
    environmentProtection: evaluateEnvironmentProtection(config),
    metadata: extraMetadata
  };

  const server = http.createServer(async (request, response) => {
    if (securityHeaders) applyPlatformSecurityHeaders(response);
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const routeKey = `${request.method || 'GET'} ${url.pathname}`;

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        sendJson(response, 200, { status: 'ok', service: descriptor.name, environment: config.appEnv }, { securityHeaders });
        return;
      }
      if (url.pathname === '/metadata' && request.method === 'GET') {
        sendJson(response, 200, payload, { securityHeaders });
        return;
      }

      const handler = routes[routeKey];
      if (handler) {
        await handler({ request, response, url, config, payload, readJsonBody, sendJson });
        return;
      }

      if (serveDesignSystemAsset(response, `${url.pathname}${url.search}`)) return;

      if (staticDir && request.method === 'GET') {
        if (serveStaticFile(response, staticDir, url.pathname)) return;
        if (url.pathname === '/' || !path.extname(url.pathname)) {
          if (serveStaticFile(response, staticDir, '/index.html')) return;
        }
      }

      sendJson(response, 404, { error: 'not_found', service: descriptor.name });
    } catch (error) {
      const status = error.code === 'payload_too_large' ? 413 : error.code === 'invalid_json' ? 400 : 500;
      sendJson(response, status, { error: error.code || 'internal_error', message: error.message });
    }
  });

  server.listen(config.servicePort, () => {
    if (typeof onReady === 'function') onReady({ config, payload });
  });
  return { server, config, payload };
}

export function runWorker({ descriptor, steps = [] }) {
  const config = loadRuntimeConfig();
  const output = { worker: descriptor, runtime: redactConfig(config), steps };

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

export function packageDir(importMetaUrl, ...segments) {
  return path.join(path.dirname(fileURLToPath(importMetaUrl)), ...segments);
}

export {
  PLATFORM_SERVICES,
  PLATFORM_ENGINES,
  listServiceEndpoints,
  listPlatformPages,
  listPlatformRoutes,
  resolveServiceEntry,
  buildServiceCliMap,
  platformRegistrySummary
} from './registry.mjs';

export {
  RELEASE_LINE,
  RELEASE_CHANNELS,
  DEFAULT_RELEASE_CHANNEL,
  listReleaseChannels,
  resolveReleaseChannel,
  resolveChannelFromEnv,
  describeReleaseChannel,
  buildReleaseManifest
};
