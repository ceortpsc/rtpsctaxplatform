// Approved secure-tunnel adapter + fail-safe tunnel gate.
// Live transport stays status='stub' until BND-005 security sign-off.
// This module validates configuration/allowlists/certs locally — no network calls.

import { accessSync, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';

const PRODUCTION_ENVIRONMENTS = new Set(['prod', 'production']);

function isSet(value) {
  const v = String(value ?? '').trim();
  return Boolean(v) && v !== 'unset' && !v.startsWith('replace-');
}

function readablePath(filePath) {
  if (!isSet(filePath)) return false;
  try {
    accessSync(path.resolve(filePath), fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fail-safe tunnel gate. Ready only when credentials, approved HTTPS endpoint,
 * and (optionally) TLS material are present. Does NOT flip adapter status off stub.
 */
export function evaluateTunnelGate({
  env = process.env,
  requireTlsFiles = false,
  signoffApproved = false
} = {}) {
  const appEnv = env.APP_ENV ?? 'local';
  const isProduction = PRODUCTION_ENVIRONMENTS.has(appEnv);
  const clientId = env.TUNNEL_CLIENT_ID;
  const clientSecret = env.TUNNEL_CLIENT_SECRET;
  const endpoint = String(env.APPROVED_TUNNEL_ENDPOINT ?? '').trim();
  const certPath = env.TLS_CERT_PATH ?? env.TUNNEL_TLS_CERT_PATH;
  const keyPath = env.TLS_KEY_PATH ?? env.TUNNEL_TLS_KEY_PATH;

  const secretsConfigured = isSet(clientId) && isSet(clientSecret);
  const endpointConfigured = isSet(endpoint);
  const endpointHttps = endpointConfigured && /^https:\/\//i.test(endpoint);
  const tlsFilesReadable = readablePath(certPath) && readablePath(keyPath);

  const reasons = [];
  if (!secretsConfigured) reasons.push('TUNNEL_CLIENT_ID / TUNNEL_CLIENT_SECRET are not fully configured.');
  if (!endpointConfigured) reasons.push('APPROVED_TUNNEL_ENDPOINT is not configured.');
  else if (!endpointHttps) reasons.push('APPROVED_TUNNEL_ENDPOINT must be an https:// URL.');
  if (requireTlsFiles && !tlsFilesReadable) {
    reasons.push('TLS_CERT_PATH / TLS_KEY_PATH are missing or unreadable.');
  }
  if (isProduction && !signoffApproved) {
    reasons.push('BND-005 security review sign-off is required before live tunnel use in production.');
  }

  // Configuration readiness (local) — separate from live adapter status.
  const configReady = secretsConfigured && endpointHttps && (!requireTlsFiles || tlsFilesReadable);
  const ready = configReady && (!isProduction || signoffApproved);

  return Object.freeze({
    company: PLATFORM_IDENTITY.company,
    application: PLATFORM_IDENTITY.application,
    appEnv,
    status: 'stub',
    ready,
    configReady,
    liveTransportEnabled: false,
    safeguards: {
      secretsConfigured,
      endpointConfigured,
      endpointHttps,
      tlsFilesReadable,
      productionEnvironment: isProduction,
      signoffApproved: signoffApproved === true
    },
    endpointHint: endpointConfigured ? endpoint.replace(/^(https:\/\/[^/]+).*/i, '$1') : null,
    reasons,
    checkedAt: new Date().toISOString()
  });
}

export function createSecureTunnelAdapter({ env = process.env, signoffApproved = false } = {}) {
  const gate = evaluateTunnelGate({ env, signoffApproved });
  return Object.freeze({
    name: 'approved-secure-tunnel-adapter',
    status: 'stub',
    gate,
    requirements: [
      'Written legal approval for the target integration.',
      'Security review for key custody, certificate rotation, and endpoint controls (BND-005).',
      'Environment-provisioned credentials and approved endpoint allowlists.',
      'HTTPS-only APPROVED_TUNNEL_ENDPOINT.'
    ],
    todo: 'Implement live transport only after compliance and security sign-off (BND-005).',
    compliance: [
      'No unauthorized access to IRS systems.',
      'Secrets must come from environment configuration.'
    ]
  });
}
