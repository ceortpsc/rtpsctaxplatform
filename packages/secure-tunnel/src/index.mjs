import { loadRuntimeConfig, evaluateEnvironmentProtection } from '../../platform-core/src/index.mjs';
import {
  APPROVED_EXTERNAL_ALLOWLIST,
  PIPELINE_TOPOLOGY,
  SERVICE_TOPOLOGY,
  WORKER_TOPOLOGY,
  topologySummary
} from './topology.mjs';

function firstEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim() !== '') {
      const trimmed = String(value).trim();
      if (trimmed === 'unset' || trimmed.startsWith('replace-')) continue;
      return trimmed;
    }
  }
  return undefined;
}

function isUnset(value) {
  return value == null || value === '' || value === 'unset';
}

/**
 * Load actual secure-tunnel + transmitter configuration from the environment.
 */
export function loadTunnelConfig(overrides = {}) {
  const runtime = loadRuntimeConfig({
    ...(overrides.runtime || {}),
    tunnelClientId: overrides.tunnelClientId ?? overrides.runtime?.tunnelClientId,
    tunnelClientSecret: overrides.tunnelClientSecret ?? overrides.runtime?.tunnelClientSecret,
    approvedTunnelEndpoint: overrides.approvedTunnelEndpoint ?? overrides.runtime?.approvedTunnelEndpoint,
    efileTransmissionEnabled: overrides.runtime?.efileTransmissionEnabled,
    appEnv: overrides.runtime?.appEnv,
    apiClientSecret: overrides.runtime?.apiClientSecret,
    tdsClientSecret: overrides.runtime?.tdsClientSecret
  });
  return {
    runtime,
    tunnelClientId: overrides.tunnelClientId ?? firstEnv('TUNNEL_CLIENT_ID') ?? runtime.tunnelClientId ?? 'unset',
    tunnelClientSecret:
      overrides.tunnelClientSecret ?? firstEnv('TUNNEL_CLIENT_SECRET') ?? runtime.tunnelClientSecret ?? 'unset',
    approvedTunnelEndpoint:
      overrides.approvedTunnelEndpoint ??
      firstEnv('APPROVED_TUNNEL_ENDPOINT') ??
      runtime.approvedTunnelEndpoint ??
      'unset',
    secondaryTunnelEndpoint: overrides.secondaryTunnelEndpoint ?? firstEnv('APPROVED_TUNNEL_ENDPOINT_SECONDARY') ?? 'unset',
    transmitterId: overrides.transmitterId ?? firstEnv('EFIN', 'ETIN', 'TRANSMITTER_ID') ?? 'unset',
    etin: overrides.etin ?? firstEnv('ETIN') ?? 'unset',
    efin: overrides.efin ?? firstEnv('EFIN') ?? 'unset',
    eroPtin: overrides.eroPtin ?? firstEnv('ERO_PTIN', 'PTIN') ?? 'unset',
    eroCaf: overrides.eroCaf ?? firstEnv('ERO_CAF_NUMBER', 'CAF_NUMBER') ?? 'unset',
    allowlistExtra: String(overrides.allowlistExtra ?? firstEnv('TUNNEL_ALLOWLIST_EXTRA') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    requireHttps: overrides.requireHttps ?? process.env.TUNNEL_REQUIRE_HTTPS !== 'false'
  };
}

export function redactTunnelConfig(config) {
  return {
    tunnelClientId: config.tunnelClientId,
    tunnelClientSecret: isUnset(config.tunnelClientSecret) ? 'unset' : '[configured]',
    approvedTunnelEndpoint: config.approvedTunnelEndpoint,
    secondaryTunnelEndpoint: config.secondaryTunnelEndpoint,
    transmitterId: config.transmitterId,
    etin: config.etin,
    efin: config.efin,
    eroPtin: config.eroPtin === 'unset' ? 'unset' : `${String(config.eroPtin).slice(0, 4)}***`,
    eroCaf: config.eroCaf === 'unset' ? 'unset' : `${String(config.eroCaf).slice(0, 3)}***`,
    allowlistExtra: config.allowlistExtra,
    requireHttps: config.requireHttps !== false,
    credentialsConfigured:
      !isUnset(config.tunnelClientId) &&
      !isUnset(config.tunnelClientSecret) &&
      !isUnset(config.approvedTunnelEndpoint)
  };
}

function endpointAllowed(url, config) {
  if (!url || url === 'unset') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (config.requireHttps !== false && parsed.protocol !== 'https:') return false;

  const allow = [
    ...APPROVED_EXTERNAL_ALLOWLIST.map((e) => e.url),
    config.approvedTunnelEndpoint,
    config.secondaryTunnelEndpoint,
    ...config.allowlistExtra
  ].filter((u) => u && u !== 'unset');

  return allow.some((allowed) => {
    try {
      const a = new URL(allowed);
      if (parsed.origin !== a.origin) return false;
      if (a.pathname === '/' || a.pathname === '') return true;
      return parsed.pathname.startsWith(a.pathname.replace(/\/$/, '')) || allowed.startsWith(parsed.origin);
    } catch {
      return url.startsWith(allowed);
    }
  });
}

/**
 * Actual secure-tunnel adapter.
 *
 * status:
 * - stub — nothing configured
 * - configured — endpoint + tunnel client present and allowlisted (local/dev OK)
 * - ready — production environment protection permits transmission
 * - blocked — configured but fail-safe still holding transmission
 */
export function createSecureTunnelAdapter(overrides = {}) {
  const config = loadTunnelConfig(overrides);
  const redacted = redactTunnelConfig(config);
  const protection = evaluateEnvironmentProtection(config.runtime);
  const endpointOk = endpointAllowed(config.approvedTunnelEndpoint, config);
  const credentialsOk = redacted.credentialsConfigured && endpointOk;

  let status = 'stub';
  if (credentialsOk && protection.transmissionAllowed) status = 'ready';
  else if (credentialsOk) status = 'configured';
  else if (!isUnset(config.approvedTunnelEndpoint) || !isUnset(config.tunnelClientId)) status = 'blocked';

  const reasons = [];
  if (isUnset(config.approvedTunnelEndpoint)) reasons.push('APPROVED_TUNNEL_ENDPOINT is unset.');
  else if (!endpointOk) reasons.push('APPROVED_TUNNEL_ENDPOINT is not on the approved HTTPS allowlist.');
  if (isUnset(config.tunnelClientId) || isUnset(config.tunnelClientSecret)) {
    reasons.push('TUNNEL_CLIENT_ID / TUNNEL_CLIENT_SECRET are not fully configured.');
  }
  if (!protection.transmissionAllowed) {
    reasons.push(...protection.reasons);
  }

  return {
    name: 'approved-secure-tunnel-adapter',
    status,
    mode: 'actual-config',
    config: redacted,
    protection,
    allowlist: APPROVED_EXTERNAL_ALLOWLIST,
    topology: topologySummary(),
    services: SERVICE_TOPOLOGY,
    workers: WORKER_TOPOLOGY,
    pipelines: PIPELINE_TOPOLOGY,
    requirements: [
      'Written legal approval for the target integration.',
      'Security review for key custody, certificate rotation, and endpoint controls.',
      'Environment-provisioned credentials and approved endpoint allowlists.',
      'Production gates must pass before status becomes ready.'
    ],
    reasons,
    validateEndpoint(url) {
      return {
        url,
        allowed: endpointAllowed(url, config),
        requireHttps: config.requireHttps !== false
      };
    },
    /**
     * Attempt a tunnel handoff. Never performs live IRS transmission unless status is ready.
     */
    async transmit(payload = {}) {
      if (status !== 'ready') {
        return {
          ok: false,
          held: true,
          outcome: 'held-pending-approval',
          status,
          reasons,
          payloadMeta: {
            batchId: payload.batchId ?? null,
            documentCount: Array.isArray(payload.documents) ? payload.documents.length : 0
          },
          at: new Date().toISOString()
        };
      }
      // Ready path still does not invent an IRS socket — callers must use irs-gateway
      // with provisioned keys. This records an authorized handoff intent.
      return {
        ok: true,
        held: false,
        outcome: 'handed-off-to-irs-gateway',
        status,
        next: {
          gateway: 'irs-gateway',
          endpoint: config.approvedTunnelEndpoint
        },
        payloadMeta: {
          batchId: payload.batchId ?? null,
          documentCount: Array.isArray(payload.documents) ? payload.documents.length : 0
        },
        at: new Date().toISOString()
      };
    },
    describe() {
      return {
        name: 'approved-secure-tunnel-adapter',
        status,
        mode: 'actual-config',
        config: redacted,
        reasons,
        topology: topologySummary(),
        transmitters: PIPELINE_TOPOLOGY.filter((p) => p.transmitter),
        gateways: SERVICE_TOPOLOGY.filter((s) => s.kind === 'gateway')
      };
    }
  };
}

export {
  APPROVED_EXTERNAL_ALLOWLIST,
  PIPELINE_TOPOLOGY,
  SERVICE_TOPOLOGY,
  WORKER_TOPOLOGY,
  topologySummary
};
