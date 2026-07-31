// RTPSC security-core — Node-native security primitives for the tax platform.
// No external deps. Fail-closed for encryption/tokens when secrets are unset.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
});

export const TOKEN_ALG = 'HS256-HMAC';
const DEFAULT_TOKEN_TTL_SEC = 3600;

/** Timing-safe string compare (length-mismatch safe via SHA-256 digest). */
export function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) {
    const digA = createHash('sha256').update(left).digest();
    const digB = createHash('sha256').update(right).digest();
    timingSafeEqual(digA, digB);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function sha256Hex(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

export function hmacHex(secret, value, algorithm = 'sha256') {
  return createHmac(algorithm, String(secret ?? '')).update(String(value ?? '')).digest('hex');
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function fromB64url(value) {
  return Buffer.from(String(value), 'base64url');
}

/** Resolve a 32-byte AES key from ENCRYPTION_KEY (raw 32 bytes, hex64, base64, or derive). */
export function resolveEncryptionKey(raw = process.env.ENCRYPTION_KEY) {
  const value = String(raw ?? '').trim();
  if (!value || value === 'unset' || value.startsWith('replace-')) {
    return null;
  }
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  try {
    const asB64 = Buffer.from(value, 'base64');
    if (asB64.length === 32) return asB64;
  } catch {
    // fall through
  }
  const utf = Buffer.from(value, 'utf8');
  if (utf.length === 32) return utf;
  return createHash('sha256').update(utf).digest();
}

export function encryptionReady(env = process.env) {
  return resolveEncryptionKey(env.ENCRYPTION_KEY) !== null;
}

/**
 * AES-256-GCM encrypt. Returns `v1.<iv>.<tag>.<ciphertext>` (all base64url).
 * Fails closed when ENCRYPTION_KEY is not provisioned.
 */
export function encryptField(plaintext, { key = resolveEncryptionKey(), aad = 'rtpsc' } = {}) {
  if (!key) {
    return { ok: false, code: 'encryption_key_unset', message: 'ENCRYPTION_KEY is not provisioned.' };
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(String(aad), 'utf8'));
  const enc = Buffer.concat([cipher.update(String(plaintext ?? ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ok: true,
    ciphertext: `v1.${b64url(iv)}.${b64url(tag)}.${b64url(enc)}`
  };
}

export function decryptField(payload, { key = resolveEncryptionKey(), aad = 'rtpsc' } = {}) {
  if (!key) {
    return { ok: false, code: 'encryption_key_unset', message: 'ENCRYPTION_KEY is not provisioned.' };
  }
  const parts = String(payload ?? '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    return { ok: false, code: 'invalid_ciphertext', message: 'Ciphertext format is invalid.' };
  }
  try {
    const iv = fromB64url(parts[1]);
    const tag = fromB64url(parts[2]);
    const data = fromB64url(parts[3]);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(String(aad), 'utf8'));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return { ok: true, plaintext: plain };
  } catch {
    return { ok: false, code: 'decrypt_failed', message: 'Decryption failed (tampered or wrong key).' };
  }
}

function resolveSigningSecret(env = process.env) {
  const value = String(env.SESSION_SECRET || env.JWT_SECRET || '').trim();
  if (!value || value === 'unset' || value.startsWith('replace-')) return null;
  return value;
}

export function sessionSecretReady(env = process.env) {
  return resolveSigningSecret(env) !== null;
}

/**
 * Mint an HMAC-signed bearer access token (not a JWT library — local HS256-HMAC envelope).
 * Fail-closed when SESSION_SECRET / JWT_SECRET unset.
 */
export function mintAccessToken(
  claims = {},
  { secret = resolveSigningSecret(), ttlSec = DEFAULT_TOKEN_TTL_SEC, now = () => Date.now() } = {}
) {
  if (!secret) {
    return { ok: false, code: 'session_secret_unset', message: 'SESSION_SECRET or JWT_SECRET is not provisioned.' };
  }
  const iat = Math.floor(now() / 1000);
  const exp = iat + Number(ttlSec || DEFAULT_TOKEN_TTL_SEC);
  const body = {
    sub: claims.sub ?? claims.clientId ?? null,
    kind: claims.kind ?? 'api',
    scopes: Array.isArray(claims.scopes) ? [...claims.scopes] : [],
    iat,
    exp,
    iss: PLATFORM_IDENTITY.abbreviation,
    alg: TOKEN_ALG
  };
  const payload = b64url(JSON.stringify(body));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return {
    ok: true,
    accessToken: `${payload}.${sig}`,
    tokenType: 'Bearer',
    expiresIn: ttlSec,
    expiresAt: new Date(exp * 1000).toISOString(),
    claims: body
  };
}

export function verifyAccessToken(
  token,
  { secret = resolveSigningSecret(), requiredScope = null, now = () => Date.now() } = {}
) {
  if (!secret) {
    return { ok: false, code: 'session_secret_unset', message: 'SESSION_SECRET or JWT_SECRET is not provisioned.' };
  }
  const raw = String(token ?? '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2) {
    return { ok: false, code: 'invalid_token', message: 'Access token format is invalid.' };
  }
  const [payload, sig] = parts;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, code: 'invalid_signature', message: 'Access token signature is invalid.' };
  }
  let claims;
  try {
    claims = JSON.parse(fromB64url(payload).toString('utf8'));
  } catch {
    return { ok: false, code: 'invalid_token', message: 'Access token payload is not JSON.' };
  }
  const nowSec = Math.floor(now() / 1000);
  if (!claims.exp || nowSec >= Number(claims.exp)) {
    return { ok: false, code: 'token_expired', message: 'Access token has expired.' };
  }
  if (requiredScope && !(claims.scopes || []).includes(requiredScope)) {
    return { ok: false, code: 'insufficient_scope', message: `Token missing required scope: ${requiredScope}` };
  }
  return { ok: true, claims };
}

export function extractBearerToken(request) {
  const header = request?.headers?.authorization ?? request?.headers?.Authorization ?? '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** Apply baseline security headers to a Node HTTP response. */
export function applySecurityHeaders(response, extra = {}) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.getHeader?.(key) && !response.getHeader?.(key.toLowerCase())) {
      response.setHeader(key, value);
    }
  }
  for (const [key, value] of Object.entries(extra)) {
    response.setHeader(key, value);
  }
}

/**
 * Sliding-window rate limiter keyed by client identity / IP.
 */
export function createRateLimiter({ limit = 60, windowMs = 60_000 } = {}) {
  /** @type {Map<string, number[]>} */
  const hits = new Map();

  function allow(key) {
    const id = String(key || 'anonymous');
    const now = Date.now();
    const windowStart = now - windowMs;
    const prior = (hits.get(id) || []).filter((t) => t > windowStart);
    if (prior.length >= limit) {
      hits.set(id, prior);
      return { ok: false, remaining: 0, retryAfterMs: Math.max(0, prior[0] + windowMs - now) };
    }
    prior.push(now);
    hits.set(id, prior);
    return { ok: true, remaining: Math.max(0, limit - prior.length), retryAfterMs: 0 };
  }

  function reset(key) {
    if (key) hits.delete(String(key));
    else hits.clear();
  }

  return { allow, reset, limit, windowMs };
}

/**
 * Append-only security audit trail (JSONL). Never write secrets.
 */
export function createSecurityAuditLog({
  auditPath = path.resolve(process.cwd(), 'logs', 'security-audit.jsonl'),
  persist = true,
  now = () => new Date().toISOString()
} = {}) {
  const memory = [];

  async function record(event = {}) {
    const entry = {
      id: `sec_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`,
      at: now(),
      company: PLATFORM_IDENTITY.company,
      ...event
    };
    // Defense: strip common secret field names if a caller slips.
    for (const key of Object.keys(entry)) {
      if (/secret|password|private.?key|authorization/i.test(key)) {
        entry[key] = '[redacted]';
      }
    }
    memory.unshift(entry);
    if (memory.length > 2000) memory.length = 2000;
    if (persist) {
      try {
        await mkdir(path.dirname(auditPath), { recursive: true });
        await appendFile(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
      } catch {
        entry.persistError = true;
      }
    }
    return entry;
  }

  return {
    record,
    list: (limit = 100) => memory.slice(0, limit),
    auditPath
  };
}

/**
 * Aggregate security posture for operator dashboards / CLI.
 */
export function evaluateSecurityPosture({
  env = process.env,
  tunnelGate = null,
  secretsStatus = null,
  encryption = encryptionReady(env),
  session = sessionSecretReady(env)
} = {}) {
  const appEnv = env.APP_ENV ?? 'local';
  const reasons = [];
  if (!session) reasons.push('SESSION_SECRET / JWT_SECRET not provisioned — HMAC access tokens unavailable.');
  if (!encryption) reasons.push('ENCRYPTION_KEY not provisioned — field encryption unavailable.');
  if (tunnelGate && tunnelGate.ready !== true) {
    reasons.push(...(tunnelGate.reasons || ['Secure tunnel gate is not ready.']));
  }
  if (secretsStatus && secretsStatus.ready !== true) {
    reasons.push(`Secrets readiness: ${secretsStatus.summary || 'incomplete'}`);
  }

  return Object.freeze({
    company: PLATFORM_IDENTITY.company,
    application: PLATFORM_IDENTITY.application,
    appEnv,
    hardenedHeaders: Object.keys(SECURITY_HEADERS),
    tokenAlgorithm: TOKEN_ALG,
    encryptionReady: encryption,
    sessionSecretReady: session,
    tunnel: tunnelGate
      ? { ready: tunnelGate.ready === true, status: tunnelGate.status ?? 'stub', reasons: tunnelGate.reasons || [] }
      : null,
    secrets: secretsStatus
      ? { ready: secretsStatus.ready === true, configuredGroups: secretsStatus.configuredGroups || [] }
      : null,
    failClosed: true,
    readyForHardenedAuth: session === true,
    reasons,
    checkedAt: new Date().toISOString()
  });
}

export function createSecurityCoreDescriptor() {
  return Object.freeze({
    name: '@rtp/security-core',
    domain: 'security',
    capabilities: [
      'hmac-access-tokens',
      'aes-256-gcm-field-encryption',
      'security-headers',
      'sliding-window-rate-limit',
      'security-audit-jsonl'
    ],
    compliance: [
      'No unauthorized access to IRS systems.',
      'Secrets must come from environment configuration.',
      'Fail-closed when SESSION_SECRET / ENCRYPTION_KEY unset.'
    ]
  });
}
