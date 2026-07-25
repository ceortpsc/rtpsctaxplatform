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
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function fetchStatus(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      })
      .on('error', reject);
  });
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
