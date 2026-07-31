// Registration + sign-in logic for the web portal, backed by @rtp/rtp-datastore.
//
// Passwords are hashed with scrypt (node:crypto) + per-account salt and compared
// with timingSafeEqual. Session tokens are random and stored hashed. Every
// attempt is appended to an audit log with the email redacted; secrets/passwords
// are never logged.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function redactEmail(email) {
  const value = String(email ?? '');
  const at = value.indexOf('@');
  if (at <= 1) return value ? `${value[0] ?? ''}***` : '***';
  return `${value.slice(0, 2)}***${value.slice(at)}`;
}

function publicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    org: account.org,
    tier: account.tier,
    createdAt: account.createdAt
  };
}

/**
 * @param {object} options
 * @param {import('@rtp/rtp-datastore').createDatabase} options.db  A datastore instance.
 * @param {string|null} [options.auditPath]  JSONL audit file (null disables file audit).
 * @param {Function} [options.now]
 */
export function createAccountsService({ db, auditPath, now = nowIso } = {}) {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('createAccountsService requires a datastore instance ("db").');
  }
  const accounts = db.collection('accounts');
  const sessions = db.collection('sessions');
  const inMemoryAudit = [];

  function audit(event, detail = {}) {
    const entry = { at: now(), event, ...detail };
    inMemoryAudit.push(entry);
    if (inMemoryAudit.length > 1000) inMemoryAudit.shift();
    if (auditPath) {
      try {
        fs.mkdirSync(path.dirname(auditPath), { recursive: true });
        fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
      } catch {
        // best-effort audit — never block the request
      }
    }
    return entry;
  }

  function issueSession(account) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    sessions.insert({ tokenHash: tokenHash(token), accountId: account.id, expiresAt });
    return { token, expiresAt };
  }

  return Object.freeze({
    register({ email, password, name, org, tier } = {}) {
      const normalizedEmail = String(email ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        audit('register.rejected', { email: redactEmail(normalizedEmail), reason: 'invalid_email' });
        return { ok: false, code: 'invalid_email', message: 'A valid email is required.' };
      }
      if (String(password ?? '').length < MIN_PASSWORD) {
        audit('register.rejected', { email: redactEmail(normalizedEmail), reason: 'weak_password' });
        return { ok: false, code: 'weak_password', message: `Password must be at least ${MIN_PASSWORD} characters.` };
      }
      if (accounts.findOne({ email: normalizedEmail })) {
        audit('register.rejected', { email: redactEmail(normalizedEmail), reason: 'email_taken' });
        return { ok: false, code: 'email_taken', message: 'An account with that email already exists.' };
      }
      const account = accounts.insert({
        email: normalizedEmail,
        name: String(name ?? '').trim() || normalizedEmail.split('@')[0],
        org: String(org ?? '').trim(),
        tier: ['starter', 'pro', 'enterprise'].includes(tier) ? tier : 'starter',
        passwordHash: hashPassword(password)
      });
      const session = issueSession(account);
      audit('register.ok', { email: redactEmail(normalizedEmail), accountId: account.id });
      return { ok: true, account: publicAccount(account), ...session };
    },

    signin({ email, password } = {}) {
      const normalizedEmail = String(email ?? '').trim().toLowerCase();
      const account = accounts.findOne({ email: normalizedEmail });
      if (!account || !verifyPassword(password, account.passwordHash)) {
        audit('signin.rejected', { email: redactEmail(normalizedEmail), reason: 'invalid_credentials' });
        return { ok: false, code: 'invalid_credentials', message: 'Email or password is incorrect.' };
      }
      const session = issueSession(account);
      audit('signin.ok', { email: redactEmail(normalizedEmail), accountId: account.id });
      return { ok: true, account: publicAccount(account), ...session };
    },

    session(token) {
      if (!token) return { ok: false, code: 'no_session' };
      const record = sessions.findOne({ tokenHash: tokenHash(token) });
      if (!record) return { ok: false, code: 'no_session' };
      if (new Date(record.expiresAt).getTime() < Date.now()) {
        sessions.remove(record.id);
        return { ok: false, code: 'expired' };
      }
      const account = accounts.getById(record.accountId);
      if (!account) return { ok: false, code: 'no_account' };
      return { ok: true, account: publicAccount(account), expiresAt: record.expiresAt };
    },

    signout(token) {
      if (!token) return { ok: true };
      const record = sessions.findOne({ tokenHash: tokenHash(token) });
      if (record) {
        sessions.remove(record.id);
        audit('signout.ok', { accountId: record.accountId });
      }
      return { ok: true };
    },

    describe() {
      return {
        accounts: accounts.count(),
        sessions: sessions.count(),
        auditEvents: inMemoryAudit.length
      };
    },

    listAudit(limit = 50) {
      return inMemoryAudit.slice(-limit);
    }
  });
}

export const __testing = { hashPassword, verifyPassword, redactEmail };
