import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPortalServer } from '../services/web-portal/src/index.mjs';
import { loadCognitoConfig } from '../services/web-portal/src/cognito.mjs';
import { evaluateImportRequest } from '../services/web-portal/src/client-import.mjs';

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

test('client import rule engine fails closed', () => {
  assert.equal(evaluateImportRequest({}).status, 'HOLD');
  assert.equal(evaluateImportRequest({
    sourceType: 'csv-client-roster', recordCount: 1, taxpayerConsent: true, encryptedTransfer: true
  }).status, 'READY_FOR_SECURE_UPLOAD');
});
