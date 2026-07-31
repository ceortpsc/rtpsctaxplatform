import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { createPortalServer } from '../services/web-portal/src/index.mjs';
import { loadCognitoConfig } from '../services/web-portal/src/cognito.mjs';
import { createCognitoSessionService } from '../services/web-portal/src/cognito-session.mjs';
import { evaluateImportRequest } from '../services/web-portal/src/client-import.mjs';
import { createAccountsService } from '../services/web-portal/src/accounts.mjs';
import { createDatabase } from '../packages/rtp-datastore/src/index.mjs';

async function startTestServer(options = {}) {
  const ctx = await createPortalServer({ persist: false, ...options });
  ctx.server.listen(0);
  await once(ctx.server, 'listening');
  const { port } = ctx.server.address();
  const base = `http://127.0.0.1:${port}`;
  return { ctx, base, close: () => new Promise((resolve) => ctx.server.close(resolve)) };
}
function cookieFrom(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}
function jwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
function signJwt(privateKey, header, payload) {
  const body = `${jwtPart(header)}.${jwtPart(payload)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url');
  return `${body}.${signature}`;
}

const localEnv = { PORTAL_AUTH_MODE: 'local' };

test('web-portal: serves public XHTML/XML and gates protected pages', async () => {
  const { base, close } = await startTestServer({ env: localEnv });
  try {
    for (const route of ['/', '/platform', '/pricing', '/register', '/signin', '/docs']) {
      const res = await fetch(`${base}${route}`);
      assert.equal(res.status, 200, `${route} status`);
      assert.match(res.headers.get('content-type'), /application\/xhtml\+xml/);
      assert.ok((await res.text()).startsWith('<?xml'));
    }
    for (const route of ['/account', '/efin', '/client-import']) {
      const res = await fetch(`${base}${route}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.match(res.headers.get('location'), /^\/signin\?next=/);
    }
    assert.match((await (await fetch(`${base}/sitemap.xml`)).text()), /<urlset/);
    assert.match((await (await fetch(`${base}/robots.txt`)).text()), /Sitemap:/);
    assert.equal((await fetch(`${base}/nope`)).status, 404);
  } finally { await close(); }
});

test('web-portal: local registration, protected EFIN workflow, and secure import gate', async () => {
  const { base, close } = await startTestServer({ env: localEnv });
  try {
    const reg = await fetch(`${base}/api/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Portal Operator', email: 'operator@example.com', password: 'supersecret1', tier: 'pro' })
    });
    assert.equal(reg.status, 201);
    const regBody = await reg.json();
    const cookie = cookieFrom(reg);
    assert.match(cookie, /rtp_portal=/);
    assert.equal((await fetch(`${base}/account`, { headers: { cookie } })).status, 200);
    assert.equal((await fetch(`${base}/client-import`, { headers: { cookie } })).status, 200);

    const efin = await fetch(`${base}/api/efin`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        efin: '123456', firmName: 'Ross Tax Pro', providerTypes: ['ero', 'transmitter'],
        responsibleName: 'Portal Operator', responsibleEmail: 'operator@example.com'
      })
    });
    assert.equal(efin.status, 201);
    const efinBody = await efin.json();
    assert.equal(efinBody.provider.efinMasked, '12••56');
    assert.equal(efinBody.provider.accountId, regBody.account.id);

    const transition = await fetch(`${base}/api/efin/${efinBody.provider.id}/transition`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ to: 'submitted' })
    });
    assert.equal((await transition.json()).provider.status, 'submitted');

    const ready = await fetch(`${base}/api/client-import/evaluate`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ sourceType: 'csv-client-roster', recordCount: 25, taxpayerConsent: true, encryptedTransfer: true })
    });
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).status, 'READY_FOR_SECURE_UPLOAD');
    assert.equal((await fetch(`${base}/api/client-import/evaluate`, { method: 'POST' })).status, 401);
  } finally { await close(); }
});

test('web-portal: Cognito configuration is fail-closed and authorization uses PKCE', async () => {
  const incomplete = loadCognitoConfig({ env: { PORTAL_AUTH_MODE: 'cognito' }, appEnv: 'production' });
  assert.equal(incomplete.configured, false);
  assert.ok(incomplete.errors.length >= 5);

  const env = {
    PORTAL_AUTH_MODE: 'cognito', COGNITO_REGION: 'us-east-1',
    COGNITO_USER_POOL_ID: 'us-east-1_example', COGNITO_CLIENT_ID: 'client123',
    COGNITO_DOMAIN: 'rtpsc-example.auth.us-east-1.amazoncognito.com',
    COGNITO_CALLBACK_URL: 'https://portal.example.com/auth/callback',
    COGNITO_LOGOUT_URL: 'https://portal.example.com/'
  };
  const { base, close } = await startTestServer({ env });
  try {
    const login = await fetch(`${base}/auth/login?next=%2Fclient-import`, { redirect: 'manual' });
    assert.equal(login.status, 302);
    const location = new URL(login.headers.get('location'));
    assert.equal(location.pathname, '/oauth2/authorize');
    assert.equal(location.searchParams.get('response_type'), 'code');
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(location.searchParams.get('code_challenge'));
    assert.ok(location.searchParams.get('state'));
    assert.ok(location.searchParams.get('nonce'));
    const localRegister = await fetch(`${base}/api/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    });
    assert.equal(localRegister.status, 409);
  } finally { await close(); }
});

test('web-portal: verifies a signed Cognito ID token before issuing a session', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  jwk.kid = 'test-key';
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  let nonce = '';
  const env = {
    PORTAL_AUTH_MODE: 'cognito', COGNITO_REGION: 'us-east-1',
    COGNITO_USER_POOL_ID: 'us-east-1_example', COGNITO_CLIENT_ID: 'client123',
    COGNITO_DOMAIN: 'rtpsc-example.auth.us-east-1.amazoncognito.com',
    COGNITO_CALLBACK_URL: 'https://portal.example.com/auth/callback',
    COGNITO_LOGOUT_URL: 'https://portal.example.com/'
  };
  const fetchImpl = async (url) => {
    if (String(url).includes('/.well-known/jwks.json')) {
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).endsWith('/oauth2/token')) {
      const idToken = signJwt(privateKey, { alg: 'RS256', kid: 'test-key', typ: 'JWT' }, {
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_example',
        aud: 'client123', token_use: 'id', exp: Math.floor(Date.now() / 1000) + 300,
        nonce, sub: 'subject-123', email: 'verified@example.com', email_verified: true, name: 'Verified Operator'
      });
      return new Response(JSON.stringify({ id_token: idToken, access_token: 'not-stored' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const { base, close } = await startTestServer({ env, fetchImpl });
  try {
    const login = await fetch(`${base}/auth/login?next=%2Fclient-import`, { redirect: 'manual' });
    const authorize = new URL(login.headers.get('location'));
    nonce = authorize.searchParams.get('nonce');
    const state = authorize.searchParams.get('state');
    const callback = await fetch(`${base}/auth/callback?code=authorization-code&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get('location'), '/client-import');
    const cookie = cookieFrom(callback);
    assert.match(cookie, /rtp_portal=/);
    const session = await fetch(`${base}/api/session`, { headers: { cookie } });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).account.email, 'verified@example.com');
  } finally { await close(); }
});

test('Cognito sessions do not silently attach to a local account by email', () => {
  const db = createDatabase({ name: `account-link-test-${Date.now()}-${Math.random()}`, persist: false });
  const localAccounts = createAccountsService({ db });
  assert.equal(localAccounts.register({ email: 'same@example.com', password: 'supersecret1' }).ok, true);
  const cognitoSessions = createCognitoSessionService({ db });
  const result = cognitoSessions.issue({
    subject: 'different-subject', email: 'same@example.com', emailVerified: true, name: 'Different Identity'
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'account_link_required');
});

test('client import rule engine fails closed', () => {
  assert.equal(evaluateImportRequest({}).status, 'HOLD');
  assert.equal(evaluateImportRequest({
    sourceType: 'csv-client-roster', recordCount: 1, taxpayerConsent: true, encryptedTransfer: true
  }).status, 'READY_FOR_SECURE_UPLOAD');
});
