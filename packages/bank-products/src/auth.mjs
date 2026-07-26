// SBTPG login validation & clearance system with durable audit logging.
//
// Credentials are loaded ONLY from environment variables (SBTPG_USERNAME /
// SBTPG_SECRET). Secrets are never returned in API responses or written to
// audit logs. Comparison uses timing-safe equality.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const PROVIDER_CODE = 'SBTPG';
const DEFAULT_AUDIT_PATH = path.resolve(process.cwd(), 'logs', 'sbtpg-login-audit.jsonl');
const CLEARANCE_TTL_MS = 60 * 60 * 1000; // 1 hour

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

function normalizeUsername(value) {
  return String(value ?? '').trim();
}

/** Load provisioned SBTPG operator credentials from the environment. */
export function loadSbtpgCredentials(env = process.env) {
  const username = normalizeUsername(env.SBTPG_USERNAME ?? env.SBTPG_USER ?? '');
  const secret = String(env.SBTPG_SECRET ?? env.SBTPG_PASSWORD ?? '');
  return {
    username: username || null,
    secretConfigured: Boolean(secret),
    // never expose secret — callers use validateSbtpgLogin with env injection in tests
    _secret: secret || null
  };
}

export function sbtpgCredentialsConfigured(env = process.env) {
  const creds = loadSbtpgCredentials(env);
  return Boolean(creds.username && creds.secretConfigured);
}

export function redactUsername(username) {
  const u = normalizeUsername(username);
  if (!u) return '(empty)';
  if (u.length <= 2) return '*'.repeat(u.length);
  return `${u.slice(0, 2)}${'*'.repeat(Math.min(8, u.length - 2))}${u.slice(-1)}`;
}

function safeEqualString(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) {
    // Still perform a compare against a hash-sized buffer to reduce trivial timing leaks.
    const digA = createHash('sha256').update(left).digest();
    const digB = createHash('sha256').update(right).digest();
    timingSafeEqual(digA, digB);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Pure credential check against expected username/secret.
 * Does not log — use createSbtpgClearanceStore().login for audited attempts.
 */
export function validateSbtpgLogin(input = {}, expected = loadSbtpgCredentials()) {
  const username = normalizeUsername(input.username ?? input.user);
  const secret = String(input.secret ?? input.password ?? '');

  if (!expected.username || !expected._secret) {
    return {
      ok: false,
      cleared: false,
      reason: 'SBTPG credentials are not provisioned in the environment (SBTPG_USERNAME / SBTPG_SECRET).',
      code: 'credentials_not_provisioned'
    };
  }
  if (!username || !secret) {
    return { ok: false, cleared: false, reason: 'Username and secret are required.', code: 'missing_credentials' };
  }

  const userOk = safeEqualString(username, expected.username);
  const secretOk = safeEqualString(secret, expected._secret);
  if (!userOk || !secretOk) {
    return { ok: false, cleared: false, reason: 'Invalid SBTPG username or secret.', code: 'invalid_credentials' };
  }

  return { ok: true, cleared: true, reason: 'Credentials validated.', code: 'cleared', username: expected.username };
}

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/**
 * In-memory clearance sessions + append-only JSONL audit log.
 * Audit entries never contain secrets or full tokens.
 */
export function createSbtpgClearanceStore({
  env = process.env,
  now = () => new Date(),
  idFactory,
  auditPath = DEFAULT_AUDIT_PATH,
  ttlMs = CLEARANCE_TTL_MS,
  persist = true
} = {}) {
  const nextId = idFactory ?? ((prefix) => defaultId(prefix));
  const sessions = new Map(); // tokenHash -> session
  const audit = [];

  async function writeAudit(entry) {
    audit.unshift(entry);
    if (audit.length > 2000) audit.length = 2000;
    if (!persist) return entry;
    try {
      await mkdir(path.dirname(auditPath), { recursive: true });
      await appendFile(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      // Audit persistence must not break login flow.
      entry.persistError = true;
    }
    return entry;
  }

  function credentialsStatus() {
    const creds = loadSbtpgCredentials(env);
    return {
      provider: PROVIDER_CODE,
      provisioned: Boolean(creds.username && creds.secretConfigured),
      usernameHint: creds.username ? redactUsername(creds.username) : null,
      envKeys: ['SBTPG_USERNAME', 'SBTPG_SECRET']
    };
  }

  async function login({ username, secret, password, meta = {} } = {}) {
    const attemptedAt = now().toISOString();
    const result = validateSbtpgLogin(
      { username, secret: secret ?? password },
      loadSbtpgCredentials(env)
    );

    const baseLog = {
      id: nextId('log'),
      provider: PROVIDER_CODE,
      event: 'login_attempt',
      outcome: result.ok ? 'success' : 'failure',
      code: result.code,
      usernameRedacted: redactUsername(username),
      reason: result.reason,
      source: meta.source ?? 'api',
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ? String(meta.userAgent).slice(0, 180) : null,
      at: attemptedAt
    };

    if (!result.ok) {
      await writeAudit(baseLog);
      return {
        cleared: false,
        clearance: null,
        error: { code: result.code, message: result.reason },
        auditId: baseLog.id
      };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(now().getTime() + ttlMs).toISOString();
    const session = {
      id: nextId('clr'),
      username: result.username,
      tokenHash,
      issuedAt: attemptedAt,
      expiresAt,
      source: meta.source ?? 'api',
      revoked: false
    };
    sessions.set(tokenHash, session);

    await writeAudit({
      ...baseLog,
      event: 'login_cleared',
      clearanceId: session.id,
      expiresAt
    });

    return {
      cleared: true,
      clearance: {
        id: session.id,
        token,
        username: session.username,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
        provider: PROVIDER_CODE,
        status: 'cleared'
      },
      auditId: baseLog.id
    };
  }

  function getSession(token) {
    if (!token) return null;
    const session = sessions.get(hashToken(token));
    if (!session || session.revoked) return null;
    if (new Date(session.expiresAt).getTime() <= now().getTime()) {
      session.revoked = true;
      return null;
    }
    return session;
  }

  function evaluateClearance(token) {
    const status = credentialsStatus();
    const session = getSession(token);
    if (!status.provisioned) {
      return {
        cleared: false,
        status: 'credentials_not_provisioned',
        credentials: status,
        session: null,
        checkedAt: now().toISOString()
      };
    }
    if (!session) {
      return {
        cleared: false,
        status: 'no_active_clearance',
        credentials: status,
        session: null,
        checkedAt: now().toISOString()
      };
    }
    return {
      cleared: true,
      status: 'cleared',
      credentials: status,
      session: {
        id: session.id,
        username: session.username,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt
      },
      checkedAt: now().toISOString()
    };
  }

  async function logout(token, meta = {}) {
    const session = token ? sessions.get(hashToken(token)) : null;
    if (session) session.revoked = true;
    const entry = await writeAudit({
      id: nextId('log'),
      provider: PROVIDER_CODE,
      event: 'logout',
      outcome: session ? 'success' : 'noop',
      clearanceId: session?.id ?? null,
      usernameRedacted: session ? redactUsername(session.username) : null,
      source: meta.source ?? 'api',
      ip: meta.ip ?? null,
      at: now().toISOString()
    });
    return { loggedOut: Boolean(session), auditId: entry.id };
  }

  function listAudit({ limit = 50 } = {}) {
    return audit.slice(0, limit);
  }

  async function readPersistedAudit({ limit = 50 } = {}) {
    try {
      const raw = await readFile(auditPath, 'utf8');
      const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(-limit)
        .reverse();
      return lines.map((line) => JSON.parse(line));
    } catch {
      return listAudit({ limit });
    }
  }

  return {
    login,
    logout,
    evaluateClearance,
    getSession,
    credentialsStatus,
    listAudit,
    readPersistedAudit,
    auditPath,
    _sessions: sessions,
    _audit: audit
  };
}

/**
 * Combined clearance view for payment/ops gates: credentials provisioned +
 * optional active operator clearance session.
 */
export function evaluateLoginClearance({ token = null, store = null, env = process.env } = {}) {
  if (store) return store.evaluateClearance(token);
  const creds = loadSbtpgCredentials(env);
  const status = {
    provider: PROVIDER_CODE,
    provisioned: Boolean(creds.username && creds.secretConfigured),
    usernameHint: creds.username ? redactUsername(creds.username) : null,
    envKeys: ['SBTPG_USERNAME', 'SBTPG_SECRET']
  };
  return {
    cleared: false,
    status: status.provisioned ? 'no_active_clearance' : 'credentials_not_provisioned',
    credentials: status,
    session: null,
    checkedAt: new Date().toISOString()
  };
}
