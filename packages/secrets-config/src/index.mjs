// RTPSC secrets-config — catalog of required environment secrets with redacted status.
// Never returns secret values. Used by compliance CFG-* and security CLI/service.

import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';

/** Groups of secrets the platform understands. */
export const SECRET_GROUPS = Object.freeze({
  api: Object.freeze(['API_CLIENT_ID', 'API_CLIENT_SECRET']),
  tds: Object.freeze(['TDS_CLIENT_ID', 'TDS_CLIENT_SECRET']),
  tunnel: Object.freeze(['TUNNEL_CLIENT_ID', 'TUNNEL_CLIENT_SECRET', 'APPROVED_TUNNEL_ENDPOINT']),
  session: Object.freeze(['SESSION_SECRET', 'JWT_SECRET']),
  encryption: Object.freeze(['ENCRYPTION_KEY']),
  sbtpg: Object.freeze(['SBTPG_USERNAME', 'SBTPG_SECRET', 'SBTPG_ENABLED']),
  irs: Object.freeze([
    'IRS_CLIENT_ID',
    'IRS_KEY_ID',
    'IRS_PRIVATE_KEY_PATH',
    'IRS_TOKEN_URL',
    'IRS_SCOPE'
  ]),
  tls: Object.freeze(['TLS_CERT_PATH', 'TLS_KEY_PATH'])
});

const PLACEHOLDER_PREFIXES = ['replace-', 'unset', 'local-', 'prod-placeholder', 'example'];

function isConfigured(value) {
  const v = String(value ?? '').trim();
  if (!v) return false;
  if (v === 'unset') return false;
  return !PLACEHOLDER_PREFIXES.some((p) => v.toLowerCase().startsWith(p.toLowerCase()));
}

function redactValue(value) {
  const v = String(value ?? '');
  if (!v) return null;
  if (v.length <= 4) return '****';
  return `${v.slice(0, 2)}…${v.slice(-2)} (${v.length} chars)`;
}

/**
 * Evaluate whether a secret group is fully provisioned.
 * `session` is special: either SESSION_SECRET or JWT_SECRET counts.
 */
export function evaluateSecretGroup(groupName, env = process.env) {
  const keys = SECRET_GROUPS[groupName];
  if (!keys) {
    return { group: groupName, configured: false, keys: [], missing: [groupName], reason: 'unknown_group' };
  }

  if (groupName === 'session') {
    const sessionOk = isConfigured(env.SESSION_SECRET);
    const jwtOk = isConfigured(env.JWT_SECRET);
    const configured = sessionOk || jwtOk;
    return {
      group: groupName,
      configured,
      keys: keys.map((key) => ({
        key,
        present: isConfigured(env[key]),
        hint: isConfigured(env[key]) ? redactValue(env[key]) : null
      })),
      missing: configured ? [] : ['SESSION_SECRET|JWT_SECRET'],
      reason: configured ? null : 'session_or_jwt_required'
    };
  }

  const keyStates = keys.map((key) => ({
    key,
    present: isConfigured(env[key]),
    hint: isConfigured(env[key]) ? redactValue(env[key]) : null
  }));
  const missing = keyStates.filter((k) => !k.present).map((k) => k.key);
  return {
    group: groupName,
    configured: missing.length === 0,
    keys: keyStates,
    missing,
    reason: missing.length ? 'incomplete' : null
  };
}

/**
 * Full redacted secrets posture. Optional `requiredGroups` defaults to
 * local-safe baseline (api/tds/tunnel/session/encryption).
 */
export function evaluateSecretsStatus({
  env = process.env,
  requiredGroups = ['api', 'tds', 'tunnel', 'session', 'encryption']
} = {}) {
  const groups = {};
  for (const name of Object.keys(SECRET_GROUPS)) {
    groups[name] = evaluateSecretGroup(name, env);
  }

  const required = requiredGroups.map((name) => groups[name]).filter(Boolean);
  const missingRequired = required.flatMap((g) => g.missing.map((k) => `${g.group}:${k}`));
  const configuredGroups = Object.values(groups)
    .filter((g) => g.configured)
    .map((g) => g.group);

  const ready = missingRequired.length === 0;
  return Object.freeze({
    company: PLATFORM_IDENTITY.company,
    application: PLATFORM_IDENTITY.application,
    appEnv: env.APP_ENV ?? 'local',
    ready,
    requiredGroups: [...requiredGroups],
    configuredGroups,
    missingRequired,
    groups,
    summary: ready
      ? `All required secret groups configured (${requiredGroups.join(', ')}).`
      : `Missing: ${missingRequired.join(', ') || 'unknown'}`,
    notice: 'Secret values are never returned — only presence/hints.',
    checkedAt: new Date().toISOString()
  });
}

export function listSecretCatalog() {
  return Object.entries(SECRET_GROUPS).map(([group, keys]) => ({
    group,
    keys: [...keys],
    source: 'environment'
  }));
}

export function createSecretsConfigDescriptor() {
  return Object.freeze({
    name: '@rtp/secrets-config',
    domain: 'security',
    responsibilities: [
      'Catalog platform secret environment keys by group.',
      'Evaluate redacted readiness without exposing values.',
      'Support CFG-004 / security doctor reporting.'
    ],
    compliance: [
      'Secrets must come from environment configuration.',
      'No credentials, secrets, or certificates in source control.'
    ]
  });
}
