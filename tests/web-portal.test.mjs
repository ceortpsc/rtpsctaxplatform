import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPortalServer } from '../services/web-portal/src/index.mjs';

async function startTestServer() {
  const ctx = await createPortalServer({ persist: false });
  ctx.server.listen(0);
  await once(ctx.server, 'listening');
  const { port } = ctx.server.address();
  const base = `http://127.0.0.1:${port}`;
  return { ctx, base, close: () => new Promise((resolve) => ctx.server.close(resolve)) };
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

test('web-portal: serves well-formed XHTML pages and XML surfaces', async () => {
  const { base, close } = await startTestServer();
  try {
    for (const route of ['/', '/platform', '/pricing', '/register', '/signin', '/efin', '/docs']) {
      const res = await fetch(`${base}${route}`);
      assert.equal(res.status, 200, `${route} status`);
      assert.match(res.headers.get('content-type'), /application\/xhtml\+xml/, `${route} content-type`);
      const body = await res.text();
      assert.ok(body.startsWith('<?xml'), `${route} has XML prolog`);
      assert.match(body, /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    }

    const sitemap = await fetch(`${base}/sitemap.xml`);
    assert.match(sitemap.headers.get('content-type'), /application\/xml/);
    assert.match(await sitemap.text(), /<urlset/);

    const feed = await fetch(`${base}/feed.xml`);
    assert.match(feed.headers.get('content-type'), /atom\+xml/);

    const robots = await fetch(`${base}/robots.txt`);
    assert.match(await robots.text(), /Sitemap:/);

    const missing = await fetch(`${base}/nope`);
    assert.equal(missing.status, 404);
  } finally {
    await close();
  }
});

test('web-portal: registration + session + EFIN onboarding end-to-end', async () => {
  const { base, close } = await startTestServer();
  try {
    const reg = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jordan', email: 'jordan@example.com', password: 'supersecret1', tier: 'pro' })
    });
    assert.equal(reg.status, 201);
    const regBody = await reg.json();
    assert.equal(regBody.ok, true);
    assert.equal(regBody.account.tier, 'pro');
    const cookie = cookieFrom(reg);
    assert.match(cookie, /rtp_portal=/);

    const session = await fetch(`${base}/api/session`, { headers: { cookie } });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).account.email, 'jordan@example.com');

    const efin = await fetch(`${base}/api/efin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        efin: '123456',
        firmName: 'Ross Tax Pro',
        providerTypes: ['ero', 'transmitter'],
        responsibleName: 'Jordan Ellis',
        responsibleEmail: 'official@example.com'
      })
    });
    assert.equal(efin.status, 201);
    const efinBody = await efin.json();
    assert.equal(efinBody.ok, true);
    assert.equal(efinBody.provider.efinMasked, '12••56');
    assert.equal(efinBody.provider.accountId, regBody.account.id);

    const list = await fetch(`${base}/api/efin`, { headers: { cookie } });
    assert.equal((await list.json()).providers.length, 1);

    const transition = await fetch(`${base}/api/efin/${efinBody.provider.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: 'submitted' })
    });
    assert.equal((await transition.json()).provider.status, 'submitted');
  } finally {
    await close();
  }
});

test('web-portal: rejects invalid registration and duplicate email', async () => {
  const { base, close } = await startTestServer();
  try {
    const weak = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com', password: 'short' })
    });
    assert.equal(weak.status, 400);
    assert.equal((await weak.json()).code, 'weak_password');

    const payload = { email: 'dup@example.com', password: 'supersecret1' };
    const first = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(first.status, 201);
    const second = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(second.status, 400);
    assert.equal((await second.json()).code, 'email_taken');
  } finally {
    await close();
  }
});
