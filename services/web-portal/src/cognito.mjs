import crypto from 'node:crypto';

const DEFAULT_SCOPES = ['openid', 'email', 'profile'];
const TRANSACTION_TTL_MS = 10 * 60 * 1000;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeDomain(value) {
  const raw = String(value ?? '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return /^https:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function safeNext(value, fallback = '/account') {
  const next = String(value ?? '').trim();
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

export function loadCognitoConfig({ env = process.env, appEnv = 'local' } = {}) {
  const requestedMode = String(env.PORTAL_AUTH_MODE ?? '').trim().toLowerCase();
  const mode = requestedMode || (appEnv === 'production' ? 'cognito' : 'local');
  const region = String(env.COGNITO_REGION ?? env.AWS_REGION ?? '').trim();
  const userPoolId = String(env.COGNITO_USER_POOL_ID ?? '').trim();
  const clientId = String(env.COGNITO_CLIENT_ID ?? '').trim();
  const domain = normalizeDomain(env.COGNITO_DOMAIN);
  const callbackUrl = String(env.COGNITO_CALLBACK_URL ?? '').trim();
  const logoutUrl = String(env.COGNITO_LOGOUT_URL ?? '').trim();
  const scopes = String(env.COGNITO_SCOPES ?? DEFAULT_SCOPES.join(' '))
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  const errors = [];
  if (!['local', 'cognito'].includes(mode)) errors.push('PORTAL_AUTH_MODE must be local or cognito.');
  if (mode === 'cognito') {
    if (!region) errors.push('COGNITO_REGION is required.');
    if (!userPoolId) errors.push('COGNITO_USER_POOL_ID is required.');
    if (!clientId) errors.push('COGNITO_CLIENT_ID is required.');
    if (!domain) errors.push('COGNITO_DOMAIN is required.');
    if (!callbackUrl) errors.push('COGNITO_CALLBACK_URL is required.');
    if (!logoutUrl) errors.push('COGNITO_LOGOUT_URL is required.');
    for (const [name, url] of [['COGNITO_CALLBACK_URL', callbackUrl], ['COGNITO_LOGOUT_URL', logoutUrl]]) {
      if (url && !/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(url)) {
        errors.push(`${name} must use HTTPS, except localhost development URLs.`);
      }
    }
  }

  const issuer = region && userPoolId ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}` : '';
  return Object.freeze({
    mode,
    enabled: mode === 'cognito',
    configured: mode === 'local' || errors.length === 0,
    errors,
    region,
    userPoolId,
    clientId,
    domain,
    callbackUrl,
    logoutUrl,
    scopes,
    issuer,
    authorizeEndpoint: domain ? `${domain}/oauth2/authorize` : '',
    tokenEndpoint: domain ? `${domain}/oauth2/token` : '',
    logoutEndpoint: domain ? `${domain}/logout` : '',
    jwksEndpoint: issuer ? `${issuer}/.well-known/jwks.json` : ''
  });
}

export function createCognitoAuth({ db, config, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  if (!db || typeof db.collection !== 'function') throw new Error('createCognitoAuth requires a datastore instance.');
  if (!config) throw new Error('createCognitoAuth requires configuration.');
  const transactions = db.collection('cognito_oauth_transactions');
  let jwksCache = null;
  let jwksExpiresAt = 0;

  function assertReady() {
    if (!config.enabled) return;
    if (!config.configured) throw new Error(`Cognito authentication is blocked: ${config.errors.join(' ')}`);
    if (typeof fetchImpl !== 'function') throw new Error('Cognito authentication requires fetch support.');
  }

  function begin(nextPath = '/account') {
    assertReady();
    if (!config.enabled) return { ok: false, code: 'cognito_disabled' };
    const state = base64url(crypto.randomBytes(32));
    const nonce = base64url(crypto.randomBytes(32));
    const verifier = base64url(crypto.randomBytes(48));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    transactions.insert({
      stateHash: hash(state),
      nonce,
      verifier,
      next: safeNext(nextPath),
      expiresAt: new Date(now() + TRANSACTION_TTL_MS).toISOString()
    });
    const url = new URL(config.authorizeEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.callbackUrl);
    url.searchParams.set('scope', config.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challenge);
    return { ok: true, location: url.toString() };
  }

  async function getJwks() {
    if (jwksCache && now() < jwksExpiresAt) return jwksCache;
    const response = await fetchImpl(config.jwksEndpoint, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Cognito JWKS request failed (${response.status}).`);
    const body = await response.json();
    if (!Array.isArray(body.keys)) throw new Error('Cognito JWKS response did not contain keys.');
    jwksCache = body.keys;
    jwksExpiresAt = now() + 60 * 60 * 1000;
    return jwksCache;
  }

  async function verifyIdToken(token, expectedNonce) {
    const parts = String(token ?? '').split('.');
    if (parts.length !== 3) throw new Error('Cognito returned an invalid ID token.');
    const header = decodeJwtPart(parts[0]);
    const claims = decodeJwtPart(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) throw new Error('Cognito ID token algorithm is not allowed.');
    const keys = await getJwks();
    const jwk = keys.find((candidate) => candidate.kid === header.kid);
    if (!jwk) throw new Error('Cognito ID token signing key was not found.');
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], 'base64url')
    );
    if (!verified) throw new Error('Cognito ID token signature verification failed.');
    const nowSeconds = Math.floor(now() / 1000);
    if (claims.iss !== config.issuer) throw new Error('Cognito ID token issuer mismatch.');
    if (claims.aud !== config.clientId) throw new Error('Cognito ID token audience mismatch.');
    if (claims.token_use !== 'id') throw new Error('Cognito token is not an ID token.');
    if (!claims.exp || claims.exp <= nowSeconds) throw new Error('Cognito ID token expired.');
    if (claims.nonce !== expectedNonce) throw new Error('Cognito ID token nonce mismatch.');
    if (!claims.sub) throw new Error('Cognito ID token is missing subject.');
    return claims;
  }

  async function callback({ code, state } = {}) {
    assertReady();
    if (!code || !state) return { ok: false, code: 'missing_callback_parameters' };
    const record = transactions.findOne({ stateHash: hash(state) });
    if (!record) return { ok: false, code: 'invalid_state' };
    transactions.remove(record.id);
    if (new Date(record.expiresAt).getTime() <= now()) return { ok: false, code: 'expired_state' };

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code: String(code),
      redirect_uri: config.callbackUrl,
      code_verifier: record.verifier
    });
    const response = await fetchImpl(config.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: form.toString()
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.id_token) {
      return { ok: false, code: 'token_exchange_failed', detail: body.error ?? `http_${response.status}` };
    }
    const claims = await verifyIdToken(body.id_token, record.nonce);
    return {
      ok: true,
      next: record.next,
      identity: {
        provider: 'cognito',
        subject: claims.sub,
        email: String(claims.email ?? '').toLowerCase(),
        name: claims.name ?? claims['cognito:username'] ?? claims.email ?? 'Portal user',
        emailVerified: claims.email_verified === true
      }
    };
  }

  function logoutLocation() {
    if (!config.enabled || !config.configured) return '/';
    const url = new URL(config.logoutEndpoint);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('logout_uri', config.logoutUrl);
    return url.toString();
  }

  function describe() {
    return {
      mode: config.mode,
      enabled: config.enabled,
      configured: config.configured,
      errors: config.errors,
      issuer: config.issuer || null,
      callbackUrl: config.callbackUrl || null,
      scopes: config.scopes
    };
  }

  return Object.freeze({ begin, callback, logoutLocation, describe, safeNext });
}

export const __testing = { base64url, hash, normalizeDomain, safeNext, decodeJwtPart };
