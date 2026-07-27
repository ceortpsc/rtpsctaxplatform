import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const APPLE_CONNECT_API_BASE = 'https://api.appstoreconnect.apple.com/v1';
export const APPLE_CONNECT_AUD = 'appstoreconnect-v1';
export const APPLE_DEVELOPER_PORTAL = 'https://developer.apple.com/account';
export const APPLE_ASC_INTEGRATIONS =
  'https://appstoreconnect.apple.com/access/integrations/api';
export const APPLE_ASC_HOME = 'https://appstoreconnect.apple.com';

const PLACEHOLDER_PREFIXES = ['replace-via-', 'replace-in-', 'unset'];

function firstEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim() !== '') {
      const trimmed = String(value).trim();
      if (PLACEHOLDER_PREFIXES.some((p) => trimmed.startsWith(p) || trimmed === 'unset')) continue;
      return trimmed;
    }
  }
  return undefined;
}

export function loadAppleConnectConfig(overrides = {}) {
  return {
    issuerId: overrides.issuerId ?? firstEnv('APPLE_ASC_ISSUER_ID') ?? 'unset',
    keyId: overrides.keyId ?? firstEnv('APPLE_ASC_KEY_ID') ?? 'unset',
    privateKeyPath:
      overrides.privateKeyPath ?? firstEnv('APPLE_ASC_PRIVATE_KEY_PATH') ?? 'unset',
    privateKeyPem: overrides.privateKeyPem ?? firstEnv('APPLE_ASC_PRIVATE_KEY_PEM') ?? 'unset',
    bundleId: overrides.bundleId ?? firstEnv('APPLE_BUNDLE_ID') ?? 'unset',
    teamId: overrides.teamId ?? firstEnv('APPLE_TEAM_ID') ?? 'unset',
    enabled: overrides.enabled ?? process.env.APPLE_CONNECT_ENABLED === 'true',
    apiBase: overrides.apiBase ?? firstEnv('APPLE_ASC_API_BASE') ?? APPLE_CONNECT_API_BASE,
    tokenTtlSeconds: Number(overrides.tokenTtlSeconds ?? process.env.APPLE_ASC_TOKEN_TTL ?? 1200)
  };
}

export function redactAppleConnectConfig(config) {
  const keyMaterialConfigured =
    (config.privateKeyPath && config.privateKeyPath !== 'unset') ||
    (config.privateKeyPem && config.privateKeyPem !== 'unset');
  return {
    issuerId: config.issuerId,
    keyId: config.keyId,
    privateKeyPath: config.privateKeyPath === 'unset' ? 'unset' : '[configured]',
    privateKeyPem: config.privateKeyPem === 'unset' ? 'unset' : '[configured]',
    bundleId: config.bundleId,
    teamId: config.teamId,
    enabled: config.enabled === true,
    apiBase: config.apiBase,
    tokenTtlSeconds: config.tokenTtlSeconds,
    secretsConfigured:
      config.issuerId !== 'unset' && config.keyId !== 'unset' && keyMaterialConfigured
  };
}

export function evaluateAppleConnectGate(config = loadAppleConnectConfig()) {
  const redacted = redactAppleConnectConfig(config);
  const reasons = [];
  if (!redacted.secretsConfigured) {
    reasons.push('App Store Connect issuer ID, key ID, and .p8 private key are not fully configured.');
  }
  if (!config.enabled) {
    reasons.push('APPLE_CONNECT_ENABLED is not set to "true".');
  }
  return Object.freeze({
    provider: 'Apple App Store Connect API',
    protected: reasons.length > 0,
    liveCallsAllowed: reasons.length === 0,
    safeguards: {
      secretsConfigured: redacted.secretsConfigured,
      enabledFlag: config.enabled === true
    },
    reasons,
    portals: {
      developer: APPLE_DEVELOPER_PORTAL,
      appStoreConnect: APPLE_ASC_HOME,
      apiKeys: APPLE_ASC_INTEGRATIONS
    },
    checkedAt: new Date().toISOString()
  });
}

function readPrivateKeyPem(config) {
  if (config.privateKeyPem && config.privateKeyPem !== 'unset') {
    return config.privateKeyPem.replace(/\\n/g, '\n');
  }
  if (config.privateKeyPath && config.privateKeyPath !== 'unset') {
    const absolute = path.isAbsolute(config.privateKeyPath)
      ? config.privateKeyPath
      : path.resolve(process.cwd(), config.privateKeyPath);
    if (!fs.existsSync(absolute)) {
      const err = new Error(`Apple private key file not found: ${absolute}`);
      err.code = 'private_key_missing';
      throw err;
    }
    return fs.readFileSync(absolute, 'utf8');
  }
  const err = new Error('Apple App Store Connect credentials are not configured.');
  err.code = 'credentials_not_configured';
  throw err;
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Create an App Store Connect API JWT (ES256).
 * Max Apple TTL is 20 minutes; default 20 minutes.
 */
export function createAppStoreConnectToken({
  issuerId,
  keyId,
  privateKeyPem,
  now = Date.now(),
  ttlSeconds = 1200,
  audience = APPLE_CONNECT_AUD
} = {}) {
  if (!issuerId || issuerId === 'unset' || !keyId || keyId === 'unset' || !privateKeyPem) {
    const err = new Error('Apple App Store Connect credentials are not configured.');
    err.code = 'credentials_not_configured';
    throw err;
  }
  const iat = Math.floor(now / 1000);
  const exp = iat + Math.min(Math.max(Number(ttlSeconds) || 1200, 60), 1200);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = { iss: issuerId, iat, exp, aud: audience };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const keyObject = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign('SHA256', Buffer.from(signingInput), {
    key: keyObject,
    dsaEncoding: 'ieee-p1363'
  });
  return `${signingInput}.${signature.toString('base64url')}`;
}

export function createTokenFromConfig(config = loadAppleConnectConfig(), now = Date.now()) {
  const pem = readPrivateKeyPem(config);
  return createAppStoreConnectToken({
    issuerId: config.issuerId,
    keyId: config.keyId,
    privateKeyPem: pem,
    now,
    ttlSeconds: config.tokenTtlSeconds
  });
}

export const REQUIRED_SETUP_STEPS = Object.freeze([
  {
    id: 'enroll_program',
    title: 'Enroll in Apple Developer Program',
    href: 'https://developer.apple.com/programs/',
    detail: 'Organization enrollment required for App Store distribution.'
  },
  {
    id: 'request_api_access',
    title: 'Request App Store Connect API access',
    href: APPLE_ASC_INTEGRATIONS,
    detail: 'Account Holder must request API access under Users and Access → Integrations.'
  },
  {
    id: 'generate_api_key',
    title: 'Generate team API key (.p8)',
    href: APPLE_ASC_INTEGRATIONS,
    detail: 'Download the private key once. Store Issuer ID, Key ID, and .p8 outside git.'
  },
  {
    id: 'provision_secrets',
    title: 'Provision RTPSC environment secrets',
    href: null,
    detail:
      'Set APPLE_ASC_ISSUER_ID, APPLE_ASC_KEY_ID, APPLE_ASC_PRIVATE_KEY_PATH (or PEM), APPLE_TEAM_ID, APPLE_BUNDLE_ID, APPLE_CONNECT_ENABLED=true.'
  },
  {
    id: 'certificates',
    title: 'Create signing certificates & profiles',
    href: 'https://developer.apple.com/account/resources/certificates/list',
    detail: 'Distribution and development certificates as required by your Apple apps.'
  },
  {
    id: 'identifiers',
    title: 'Register App IDs / bundle identifiers',
    href: 'https://developer.apple.com/account/resources/identifiers/list',
    detail: 'Enable Sign in with Apple / Push Notifications only when the product needs them.'
  },
  {
    id: 'testflight',
    title: 'Configure TestFlight',
    href: 'https://appstoreconnect.apple.com/apps',
    detail: 'Optional beta distribution after first build upload.'
  }
]);

export const CAPABILITY_CATALOG = Object.freeze([
  {
    id: 'asc_api',
    label: 'App Store Connect API',
    status: 'implemented_stub',
    detail: 'JWT ES256 auth + gated REST client for apps/builds metadata.'
  },
  {
    id: 'developer_portal_links',
    label: 'Developer portal deep links',
    status: 'implemented',
    detail: 'Console UI links to certificates, identifiers, devices, and ASC integrations.'
  },
  {
    id: 'sign_in_with_apple',
    label: 'Sign in with Apple',
    status: 'configuration_required',
    detail: 'Requires Services ID + key in Apple Developer; not enabled until secrets provisioned.'
  },
  {
    id: 'apns',
    label: 'Apple Push Notification service',
    status: 'configuration_required',
    detail: 'Requires APNs key (.p8) distinct from ASC API key.'
  },
  {
    id: 'testflight',
    label: 'TestFlight automation',
    status: 'limited',
    detail: 'Endpoint stubs ready; live beta group calls require APPLE_CONNECT_ENABLED.'
  }
]);

export async function appleConnectFetch(pathname, { config = loadAppleConnectConfig(), method = 'GET', body } = {}) {
  const gate = evaluateAppleConnectGate(config);
  if (!gate.liveCallsAllowed) {
    const err = new Error(gate.reasons.join(' '));
    err.code = 'credentials_not_configured';
    err.gate = gate;
    throw err;
  }
  const token = createTokenFromConfig(config);
  const url = `${config.apiBase.replace(/\/$/, '')}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const err = new Error(`Apple API ${response.status}`);
    err.code = 'apple_api_error';
    err.status = response.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function listApps(config = loadAppleConnectConfig()) {
  return appleConnectFetch('/apps?limit=50', { config });
}

export function descriptor() {
  return {
    name: 'apple-connect',
    version: '0.1.0',
    apiBase: APPLE_CONNECT_API_BASE,
    capabilities: CAPABILITY_CATALOG.map((c) => c.id),
    setupSteps: REQUIRED_SETUP_STEPS.length
  };
}
