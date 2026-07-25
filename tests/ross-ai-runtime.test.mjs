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
      assert.match(home.body, /Ross/);
      assert.match(home.body, /Runtime Platform/);
      assert.equal(home.status, 200);

      for (const p of ['/signin', '/login', '/signup']) {
        const page = await fetchText(`${base}${p}`);
        assert.equal(page.status, 200, p);
        assert.match(page.body, /Access gate|password/i);
      }

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
      assert.match(signup.headers.location || '', /dashboard/);
      const cookie = cookieFromSet(signup.headers['set-cookie']);
      assert.ok(cookie.includes('ross_session='));

      const dash = await fetchText(`${base}/dashboard`, { headers: { Cookie: cookie } });
      assert.equal(dash.status, 200);
      assert.match(dash.body, /Control plane/);
      assert.match(dash.body, /Live stream/);

      for (const p of ['/modules', '/engines', '/systems', '/infrastructure', '/packages', '/deploy', '/runtime']) {
        const page = await fetchText(`${base}${p}`, { headers: { Cookie: cookie } });
        assert.equal(page.status, 200, p);
      }

      const inv = await fetchJson(`${base}/api/inventory`, { headers: { Cookie: cookie } });
      assert.ok(inv.total >= 10);
      assert.ok(inv.bySector.engines);

      const hard = await fetchJson(`${base}/api/hardening`, { headers: { Cookie: cookie } });
      assert.ok(hard.score >= 50);
      assert.ok(Array.isArray(hard.controls));

      const css = await fetchResponse(`${base}/static/app.css`);
      assert.equal(css.status, 200);
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
          for (const [k, v] of Object.entries(res.headers)) {
            const key = k.toLowerCase();
            if (key === 'set-cookie' && Array.isArray(v)) {
              headers[key] = v[0];
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

function postForm(url, fields) {
  const body = new URLSearchParams(fields).toString();
  return fetchResponse(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    },
    body
  });
}

function cookieFromSet(setCookie) {
  if (!setCookie) return '';
  return String(setCookie).split(',')[0].split(';')[0];
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
