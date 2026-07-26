/**
 * Gateway Communications Tunnel — Treasury TOPS / Fiscal Service.
 *
 * Stub-safe by default. No live Fiscal Service / TOPS / BFS calls until
 * environment protection + explicit enablement pass.
 */

import {
  PLATFORM_IDENTITY,
  loadRuntimeConfig,
  evaluateEnvironmentProtection
} from '../../platform-core/src/index.mjs';

export const TREASURY_FISCAL_PROVIDER = Object.freeze({
  code: 'USDTFS',
  name: 'U.S. Department of the Treasury — Bureau of the Fiscal Service',
  systems: Object.freeze(['TOPS', 'FFIS', 'BFS']),
  notice:
    'Communications tunnel is stub-safe. Live TOPS/FFIS traffic requires legal approval, security review, and provisioned credentials.'
});

export function loadGatewayCommsConfig(overrides = {}) {
  const runtime = loadRuntimeConfig(overrides);
  return {
    appEnv: runtime.appEnv,
    enabled: overrides.enabled ?? process.env.GATEWAY_COMMS_ENABLED === 'true',
    topsEndpoint: overrides.topsEndpoint ?? process.env.TOPS_ENDPOINT ?? 'unset',
    fiscalEndpoint: overrides.fiscalEndpoint ?? process.env.FISCAL_SERVICE_ENDPOINT ?? 'unset',
    clientId: overrides.clientId ?? process.env.TOPS_CLIENT_ID ?? process.env.FISCAL_CLIENT_ID ?? 'unset',
    clientSecret:
      overrides.clientSecret ?? process.env.TOPS_CLIENT_SECRET ?? process.env.FISCAL_CLIENT_SECRET ?? 'unset',
    approvedTunnelEndpoint: runtime.approvedTunnelEndpoint
  };
}

/** Fail-safe gate for Treasury TOPS / Fiscal Service communications. */
export function evaluateGatewayCommsProtection(config = loadGatewayCommsConfig()) {
  const env = evaluateEnvironmentProtection();
  const reasons = [];
  if (!config.enabled) reasons.push('GATEWAY_COMMS_ENABLED is not set to "true".');
  if (!config.topsEndpoint || config.topsEndpoint === 'unset') {
    reasons.push('TOPS_ENDPOINT is not configured.');
  }
  if (!config.fiscalEndpoint || config.fiscalEndpoint === 'unset') {
    reasons.push('FISCAL_SERVICE_ENDPOINT is not configured.');
  }
  if (!config.clientId || config.clientId === 'unset' || !config.clientSecret || config.clientSecret === 'unset') {
    reasons.push('TOPS/Fiscal client credentials are not fully configured.');
  }
  if (env.protected || !env.transmissionAllowed) {
    reasons.push('Platform environment protection blocks live communications.');
    reasons.push(...(env.reasons ?? []).slice(0, 4));
  }
  const allowed = reasons.length === 0;
  return Object.freeze({
    company: PLATFORM_IDENTITY.company,
    provider: TREASURY_FISCAL_PROVIDER,
    allowed,
    status: allowed ? 'ready' : 'blocked',
    enabled: Boolean(config.enabled),
    endpoints: {
      tops: config.topsEndpoint === 'unset' ? null : 'configured',
      fiscal: config.fiscalEndpoint === 'unset' ? null : 'configured',
      approvedTunnel: config.approvedTunnelEndpoint === 'unset' ? null : 'configured'
    },
    reasons,
    checkedAt: new Date().toISOString()
  });
}

/**
 * Create the Gateway Communications Tunnel adapter (stub by default).
 * Mirrors createSecureTunnelAdapter() shape for compliance catalogs.
 */
export function createGatewayCommsTunnelAdapter(options = {}) {
  const config = loadGatewayCommsConfig(options);
  const gate = evaluateGatewayCommsProtection(config);
  return Object.freeze({
    name: 'gateway-comms-tunnel-treasury-tops',
    provider: TREASURY_FISCAL_PROVIDER,
    status: gate.allowed ? 'configured' : 'stub',
    systems: [...TREASURY_FISCAL_PROVIDER.systems],
    gate,
    requirements: [
      'Written legal approval for Treasury Fiscal Service / TOPS integration.',
      'Security review for key custody, mutual TLS, and endpoint allowlists.',
      'Environment-provisioned TOPS/Fiscal credentials (never commit secrets).',
      'GATEWAY_COMMS_ENABLED=true only after platform environment protection passes.'
    ],
    todo: 'Implement live Fiscal/TOPS channel only after compliance and security sign-off.',
    describe() {
      return {
        name: this.name,
        status: this.status,
        provider: this.provider,
        gate: this.gate,
        requirements: this.requirements
      };
    }
  });
}

/** Probe tunnel health — never opens a live socket in stub mode. */
export function probeGatewayCommsTunnel(options = {}) {
  const adapter = createGatewayCommsTunnelAdapter(options);
  return {
    ok: adapter.status === 'configured',
    status: adapter.status,
    provider: adapter.provider.code,
    systems: adapter.systems,
    gate: adapter.gate,
    message:
      adapter.status === 'configured'
        ? 'Gateway communications tunnel credentials present (live calls still require explicit operator invoke).'
        : 'Tunnel stub active — Treasury TOPS / Fiscal Service traffic blocked.',
    probedAt: new Date().toISOString()
  };
}

/** Record a stub communications attempt for audit/demo (no network). */
export function openGatewayCommsSession(intent = {}, options = {}) {
  const adapter = createGatewayCommsTunnelAdapter(options);
  const channel = String(intent.channel ?? 'TOPS').toUpperCase();
  const allowed = adapter.gate.allowed && adapter.systems.includes(channel);
  return {
    sessionId: `gct_${Date.now().toString(36)}`,
    channel,
    status: allowed ? 'session_ready_stub' : 'denied',
    adapter: adapter.name,
    provider: adapter.provider.name,
    allowed,
    reasons: allowed ? [] : adapter.gate.reasons,
    intent: {
      purpose: intent.purpose ?? 'federal-refund-trace',
      caseId: intent.caseId ?? null,
      taxpayerRef: intent.taxpayerRef ?? null
    },
    notice: TREASURY_FISCAL_PROVIDER.notice,
    openedAt: new Date().toISOString()
  };
}
