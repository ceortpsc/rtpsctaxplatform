import crypto from 'node:crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function publicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    org: account.org || '',
    tier: account.tier || 'starter',
    authProvider: account.authProvider || 'cognito',
    createdAt: account.createdAt
  };
}

export function createCognitoSessionService({ db, now = () => Date.now() } = {}) {
  if (!db || typeof db.collection !== 'function') throw new Error('Cognito session service requires a datastore.');
  const accounts = db.collection('accounts');
  const sessions = db.collection('sessions');

  function issue(identity = {}) {
    const subject = String(identity.subject ?? '').trim();
    const email = String(identity.email ?? '').trim().toLowerCase();
    if (!subject || !email) return { ok: false, code: 'incomplete_cognito_identity' };
    if (identity.emailVerified !== true) return { ok: false, code: 'verified_email_required' };

    const externalKey = `cognito:${subject}`;
    let account = accounts.findOne({ externalKey });
    if (!account) {
      const emailMatch = accounts.findOne({ email });
      if (emailMatch) {
        return {
          ok: false,
          code: 'account_link_required',
          message: 'An existing account uses this email. Complete an administrator-approved identity-link workflow.'
        };
      }
      account = accounts.insert({
        externalKey,
        authProvider: 'cognito',
        email,
        name: String(identity.name ?? email).trim(),
        emailVerified: true,
        tier: 'starter',
        org: ''
      });
    } else {
      account = accounts.update(account.id, {
        email,
        name: String(identity.name ?? account.name ?? email).trim(),
        emailVerified: true,
        authProvider: 'cognito'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(now() + SESSION_TTL_MS).toISOString();
    sessions.insert({ tokenHash: tokenHash(token), accountId: account.id, expiresAt, provider: 'cognito' });
    return { ok: true, token, expiresAt, account: publicAccount(account) };
  }

  return Object.freeze({ issue });
}
