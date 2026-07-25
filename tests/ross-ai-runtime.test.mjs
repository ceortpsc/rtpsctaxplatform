import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, access, readFile, cp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import net from 'node:net';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function ross(args, cwd = repoRoot) {
  return spawnSync('python3', [path.join(repoRoot, 'ross.py'), ...args], {
    cwd,
    encoding: 'utf8',
    env: process.env
  });
}

async function copyPlatformTo(tmp) {
  for (const rel of ['ross.py', 'ross_ai', 'requirements.txt', 'docker-compose.ross.yml', 'Dockerfile.ross']) {
    await cp(path.join(repoRoot, rel), path.join(tmp, rel), { recursive: true });
  }
}

describe('Ross AI Runtime Platform', () => {
  it('prints help and version', () => {
    const help = ross(['help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Ross AI Runtime Platform/);
    assert.match(help.stdout, /package build/);

    const version = ross(['version']);
    assert.equal(version.status, 0);
    assert.match(version.stdout, /^ross\//);
  });

  it('init → doctor → package build → runtime hello → deploy plans', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'ross-fixture-'));
    try {
      await copyPlatformTo(tmp);
      const init = ross(['init'], tmp);
      assert.equal(init.status, 0, init.stderr || init.stdout);
      await access(path.join(tmp, 'ross.json'));
      await access(path.join(tmp, 'workspace/scripts/hello.py'));

      const doctor = ross(['doctor', '--json'], tmp);
      assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
      const report = JSON.parse(doctor.stdout);
      assert.equal(report.ok, true);

      const pkg = ross(['package', 'build'], tmp);
      assert.equal(pkg.status, 0, pkg.stderr || pkg.stdout);
      await access(path.join(tmp, 'workspace/dist/application.rpkg'));
      await access(path.join(tmp, 'workspace/dist/application.rpkg.sha256'));
      const sha = await readFile(path.join(tmp, 'workspace/dist/application.rpkg.sha256'), 'utf8');
      assert.match(sha, /^[a-f0-9]{64}\s+application\.rpkg/);

      const hello = ross(['runtime', 'run', 'hello'], tmp);
      assert.equal(hello.status, 0, hello.stderr || hello.stdout);
      assert.match(hello.stdout, /hello from Ross AI Runtime Platform/);

      for (const target of [
        'local',
        'docker',
        'kubernetes',
        'aws-lambda',
        'aws-ecs',
        'azure-functions',
        'gcp-cloud-run',
        'edge-worker'
      ]) {
        const plan = ross(['deploy', 'plan', target], tmp);
        assert.equal(plan.status, 0, `${target}: ${plan.stderr || plan.stdout}`);
        const body = JSON.parse(plan.stdout);
        assert.equal(body.target, target);
        assert.ok(Array.isArray(body.steps));
        await access(path.join(tmp, `workspace/plans/${target}.json`));
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('dev server serves /health and /metadata', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'ross-dev-'));
    let child;
    const port = await freePort();
    try {
      await copyPlatformTo(tmp);
      assert.equal(ross(['init'], tmp).status, 0);

      child = spawn(
        'python3',
        [path.join(tmp, 'ross.py'), 'dev', '--host', '127.0.0.1', '--port', String(port)],
        { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] }
      );

      const base = `http://127.0.0.1:${port}`;
      await waitForHealth(`${base}/health`, 15000);

      const health = await fetchJson(`${base}/health`);
      assert.equal(health.status, 'ok');

      const meta = await fetchJson(`${base}/metadata`);
      assert.match(String(meta.product), /Ross AI Runtime Platform/);
      assert.ok(meta.scripts.includes('hello'));

      const missing = await fetchStatus(`${base}/nope`);
      assert.equal(missing, 404);
    } finally {
      if (child && !child.killed) {
        child.kill('SIGTERM');
        await new Promise((r) => child.once('exit', r));
      }
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('landing, access gates, signup → dashboard, protected APIs', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'ross-auth-'));
    let child;
    const port = await freePort();
    try {
      await copyPlatformTo(tmp);
      assert.equal(ross(['init'], tmp).status, 0);
      child = spawn(
        'python3',
        [path.join(tmp, 'ross.py'), 'dev', '--host', '127.0.0.1', '--port', String(port)],
        { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      const base = `http://127.0.0.1:${port}`;
      await waitForHealth(`${base}/health`, 15000);

      const home = await fetchText(`${base}/`);
      assert.equal(home.status, 200);
      assert.match(home.body, /ROSS/);
      assert.match(home.body, /Ross AI Runtime Platform/);
      assert.match(home.body, /Ross Tax Software/);
      assert.match(home.body, /application\/ld\+json/);
      assert.match(home.body, /SoftwareApplication/);
      assert.match(home.body, /BreadcrumbList/);
      assert.match(home.body, /og:title/);
      assert.match(home.body, /twitter:card/);
      assert.match(home.body, /canonical/);
      assert.match(home.body, /googlebot/);
      assert.match(home.body, /bingbot/);

      const robots = await fetchText(`${base}/robots.txt`);
      assert.equal(robots.status, 200);
      assert.match(robots.body, /Sitemap:/);
      assert.match(robots.body, /Disallow: \/dashboard/);
      assert.match(robots.body, /Allow: \/marketplace/);

      const sitemap = await fetchText(`${base}/sitemap.xml`);
      assert.equal(sitemap.status, 200);
      assert.match(sitemap.body, /<urlset/);
      assert.match(sitemap.body, /marketplace/);
      assert.match(sitemap.body, /signup/);
      assert.match(sitemap.body, /legal/);

      const manifest = await fetchJson(`${base}/site.webmanifest`);
      assert.equal(manifest.short_name, 'ROSS');
      assert.match(String(manifest.name), /Ross AI Runtime Platform/);

      const metaBrand = await fetchJson(`${base}/metadata`);
      assert.equal(metaBrand.appName, 'ROSS');
      assert.equal(metaBrand.seo.sitemap, '/sitemap.xml');

      for (const p of ['/signin', '/login', '/signup']) {
        const page = await fetchText(`${base}${p}`);
        assert.equal(page.status, 200, p);
        assert.match(page.body, /Access gate|password/i);
        assert.match(page.body, /rel="canonical"/);
      }

      const marketplacePublic = await fetchText(`${base}/marketplace`);
      assert.equal(marketplacePublic.status, 200);
      assert.match(marketplacePublic.body, /index,follow/);
      assert.match(marketplacePublic.body, /Membership Marketplace|membership tiers/i);

      const dashAnon = await fetchResponse(`${base}/dashboard`);
      assert.equal(dashAnon.status, 303);
      assert.match(dashAnon.headers.location || '', /signin/);

      const email = `ops_${port}@rosstaxsoftware.com`;
      const signup = await postForm(`${base}/signup`, {
        name: 'Ops Lead',
        email,
        password: 'RuntimeGate1'
      });
      assert.equal(signup.status, 303);
      assert.match(signup.headers.location || '', /verify-email/);
      const cookie = cookieFromSet(signup.headers['set-cookie']);
      assert.ok(cookie.includes('ross_session='));

      const verifyPage = await fetchText(`${base}/verify-email`, { headers: { Cookie: cookie } });
      assert.equal(verifyPage.status, 200);
      assert.match(verifyPage.body, /Verify your email|6-digit/);
      const emailCode = (verifyPage.body.match(/class="code-xl">(\d{6})</) || [])[1];
      assert.ok(emailCode, 'dev verification code missing');
      const verifyCsrf = csrfFromHtml(verifyPage.body);
      const verified = await postForm(
        `${base}/verify-email`,
        { csrf: verifyCsrf, code: emailCode },
        { Cookie: cookie }
      );
      assert.equal(verified.status, 303);
      assert.match(verified.headers.location || '', /setup-mfa/);

      const mfaPage = await fetchText(`${base}/setup-mfa`, { headers: { Cookie: cookie } });
      assert.equal(mfaPage.status, 200);
      assert.match(mfaPage.body, /Enable authenticator MFA|MFA/);
      const secret = (mfaPage.body.match(/class="code-xl wrap">([A-Z2-7]+)</) || [])[1];
      assert.ok(secret, 'totp secret missing');
      const totp = totpNow(secret, tmp);
      const mfaCsrf = csrfFromHtml(mfaPage.body);
      const mfaEnabled = await postForm(
        `${base}/setup-mfa`,
        { csrf: mfaCsrf, code: totp },
        { Cookie: cookie }
      );
      assert.equal(mfaEnabled.status, 303, mfaEnabled.headers.location);
      assert.match(mfaEnabled.headers.location || '', /membership/);

      const market = await fetchText(`${base}/marketplace`);
      assert.equal(market.status, 200);
      assert.match(market.body, /Starter/);
      assert.match(market.body, /Professional/);
      assert.match(market.body, /Firm/);
      assert.match(market.body, /Enterprise/);
      assert.match(market.body, /ZERO REFUNDS/);

      const legal = await fetchText(`${base}/legal`);
      assert.equal(legal.status, 200);
      assert.match(legal.body, /Disclosures/);
      assert.match(legal.body, /ABSOLUTELY ZERO/);

      const memPage = await fetchText(`${base}/membership`, { headers: { Cookie: cookie } });
      assert.equal(memPage.status, 200);
      assert.match(memPage.body, /Membership election|Choose your tier/);
      const csrf = csrfFromHtml(memPage.body);

      const elect = await postForm(
        `${base}/membership`,
        {
          csrf,
          tierId: 'professional',
          cadence: 'monthly',
          accept_0: '1',
          accept_1: '1',
          accept_2: '1',
          accept_3: '1',
          zeroRefunds: '1'
        },
        { Cookie: cookie }
      );
      assert.equal(elect.status, 303);
      assert.match(elect.headers.location || '', /payment/);

      const payPage = await fetchText(`${base}/payment`, { headers: { Cookie: cookie } });
      assert.equal(payPage.status, 200);
      assert.match(payPage.body, /Payment method on file/);
      const payCsrf = csrfFromHtml(payPage.body);

      const pay = await postForm(
        `${base}/payment`,
        {
          csrf: payCsrf,
          cardName: 'Ops Lead',
          cardNumber: '4242424242424242',
          expMonth: '12',
          expYear: '2030',
          cvc: '123',
          zip: '10001',
          autopay: '1',
          zeroRefunds: '1',
          disclosures: '1'
        },
        { Cookie: cookie }
      );
      assert.equal(pay.status, 303, await pay.text?.() || pay.headers.location);
      assert.match(pay.headers.location || '', /dashboard/);

      const dash = await fetchText(`${base}/dashboard`, { headers: { Cookie: cookie } });
      assert.equal(dash.status, 200);
      assert.match(dash.body, /Control plane/);
      assert.match(dash.body, /ZERO REFUNDS/);

      // Sign out and sign in with MFA (email factor)
      const logoutCsrf = csrfFromHtml(dash.body);
      await postForm(`${base}/logout`, { csrf: logoutCsrf }, { Cookie: cookie });

      const signin = await postForm(`${base}/signin`, {
        email,
        password: 'RuntimeGate1'
      });
      assert.equal(signin.status, 303);
      assert.match(signin.headers.location || '', /mfa/);
      const mfaCookie = cookieFromSet(signin.headers['set-cookie']);
      assert.ok(mfaCookie.includes('ross_mfa='));

      const challengePage = await fetchText(`${base}/mfa`, { headers: { Cookie: mfaCookie } });
      assert.equal(challengePage.status, 200);
      await postForm(`${base}/mfa/email`, {}, { Cookie: mfaCookie });
      const challenge2 = await fetchText(`${base}/mfa`, { headers: { Cookie: mfaCookie } });
      const loginCode = (challenge2.body.match(/class="code-xl">(\d{6})</) || [])[1];
      assert.ok(loginCode);
      const mfaLogin = await postForm(
        `${base}/mfa`,
        { factor: 'email', code: loginCode },
        { Cookie: mfaCookie }
      );
      assert.equal(mfaLogin.status, 303);
      assert.match(mfaLogin.headers.location || '', /dashboard/);

      const sessionCookie = cookieFromSet(mfaLogin.headers['set-cookie-all'] || mfaLogin.headers['set-cookie']);
      assert.ok(sessionCookie.includes('ross_session='));

      for (const p of ['/modules', '/billing', '/users', '/marketplace', '/engines', '/systems', '/infrastructure', '/packages', '/deploy', '/runtime', '/execute', '/rbac']) {
        const page = await fetchText(`${base}${p}`, {
          headers: { Cookie: sessionCookie }
        });
        assert.equal(page.status, 200, p);
      }

      const billing = await fetchText(`${base}/billing`, { headers: { Cookie: sessionCookie } });
      assert.equal(billing.status, 200);
      assert.match(billing.body, /Professional|autopay|4242|ZERO REFUNDS/i);

      const inv = await fetchJson(`${base}/api/inventory`, { headers: { Cookie: sessionCookie } });
      assert.ok(inv.total >= 10);
      assert.ok(inv.bySector.engines);

      const hard = await fetchJson(`${base}/api/hardening`, { headers: { Cookie: sessionCookie } });
      assert.ok(hard.score >= 50);
      assert.ok(Array.isArray(hard.controls));

      const css = await fetchResponse(`${base}/static/app.css`);
      assert.equal(css.status, 200);

      // Transparent execution
      const execPage = await fetchText(`${base}/execute`, { headers: { Cookie: sessionCookie } });
      assert.equal(execPage.status, 200);
      assert.match(execPage.body, /Transparent code execution|Execute/);
      const execCsrf = csrfFromHtml(execPage.body);
      const ran = await postForm(
        `${base}/execute`,
        { csrf: execCsrf, scriptId: 'shared:hello.py' },
        { Cookie: sessionCookie }
      );
      assert.equal(ran.status, 200);
      assert.match(ran.headers['content-type'] || '', /html/);
      const ranBody = await ran.text();
      assert.match(ranBody, /hello from Ross|Last execution|stdout/i);

      // RBAC matrix
      const rbac = await fetchText(`${base}/rbac`, { headers: { Cookie: sessionCookie } });
      assert.equal(rbac.status, 200);
      assert.match(rbac.body, /Roles|operator|permissions/i);
      const rbacApi = await fetchJson(`${base}/api/rbac`, { headers: { Cookie: sessionCookie } });
      assert.ok(rbacApi.roles.length >= 6);
      assert.equal(rbacApi.defaultRole, 'operator');

      // GitHub create-account integration (dev simulate) — still requires local password
      const gh = await fetchResponse(`${base}/auth/github`, { method: 'GET' });
      assert.equal(gh.status, 303);
      assert.match(gh.headers.location || '', /auth\/github\/callback/);
      const cb = await fetchResponse(`${base}${gh.headers.location}`);
      assert.equal(cb.status, 303);
      assert.match(cb.headers.location || '', /set-password/);
      const ghCookie = cookieFromSet(cb.headers['set-cookie-all'] || cb.headers['set-cookie']);
      assert.ok(ghCookie.includes('ross_session='));

      const beforePwd = await fetchResponse(`${base}/dashboard`, { headers: { Cookie: ghCookie } });
      assert.equal(beforePwd.status, 303);
      assert.match(beforePwd.headers.location || '', /set-password/);

      const setPwdPage = await fetchText(`${base}/set-password`, { headers: { Cookie: ghCookie } });
      assert.equal(setPwdPage.status, 200);
      assert.match(setPwdPage.body, /Create your password|GitHub account/i);
      const setPwdCsrf = csrfFromHtml(setPwdPage.body);
      const setPwd = await postForm(
        `${base}/set-password`,
        { csrf: setPwdCsrf, password: 'GithubGate1', confirm: 'GithubGate1' },
        { Cookie: ghCookie }
      );
      assert.equal(setPwd.status, 303);
      assert.match(setPwd.headers.location || '', /setup-mfa/);

      const afterPwd = await fetchResponse(`${base}/dashboard`, { headers: { Cookie: ghCookie } });
      assert.equal(afterPwd.status, 303);
      assert.match(afterPwd.headers.location || '', /setup-mfa/);
    } finally {
      if (child && !child.killed) {
        child.kill('SIGTERM');
        await new Promise((r) => child.once('exit', r));
      }
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on('error', reject);
  });
}

function fetchJson(url, opts = {}) {
  return fetchResponse(url, opts).then(async (res) => {
    const text = await res.text();
    return JSON.parse(text);
  });
}

function fetchText(url, opts = {}) {
  return fetchResponse(url, opts).then(async (res) => ({
    status: res.status,
    body: await res.text(),
    headers: res.headers
  }));
}

function fetchStatus(url) {
  return fetchResponse(url).then((res) => {
    res.resume?.();
    return res.status;
  });
}

function fetchResponse(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method || 'GET',
        headers: opts.headers || {}
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const headers = {};
          const setCookies = [];
          for (const [k, v] of Object.entries(res.headers)) {
            const key = k.toLowerCase();
            if (key === 'set-cookie') {
              if (Array.isArray(v)) setCookies.push(...v);
              else if (v) setCookies.push(v);
              headers[key] = setCookies[0] || '';
              headers['set-cookie-all'] = setCookies;
            } else {
              headers[key] = Array.isArray(v) ? v.join(',') : v;
            }
          }
          resolve({
            status: res.statusCode,
            headers,
            text: async () => body,
            resume() {}
          });
        });
      }
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function postForm(url, fields, headers = {}) {
  const body = new URLSearchParams(fields).toString();
  return fetchResponse(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      ...headers
    },
    body
  });
}

function cookieFromSet(setCookie, prefer = 'ross_session') {
  const list = Array.isArray(setCookie)
    ? setCookie
    : String(setCookie || '')
        .split(/,(?=\s*[^;]+=)/)
        .map((s) => s.trim())
        .filter(Boolean);
  const hit = list.find((c) => c.startsWith(`${prefer}=`) && !c.startsWith(`${prefer}=;`));
  if (hit) return hit.split(';')[0];
  if (!list.length) return '';
  return list[0].split(';')[0];
}

function csrfFromHtml(html) {
  const m = html.match(/name="csrf"\s+value="([^"]+)"/);
  assert.ok(m, 'csrf token missing');
  return m[1];
}

function totpNow(secret, cwd) {
  const r = spawnSync(
    'python3',
    ['-c', `from ross_ai.otp import totp_at; print(totp_at(${JSON.stringify(secret)}))`],
    { cwd, encoding: 'utf8', env: process.env }
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return r.stdout.trim();
}

function waitForHealth(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}
