#!/usr/bin/env node
/**
 * Start the RTPSC Tax Platform in entirety:
 * - HTTP services: api-gateway :3000, refund-status :3001, transcript :3002, analytics :3003
 * - Workers (one-shot): tds, transcript-pull, live-source
 * - Optional: --no-workers, --services-only, --check-only
 *
 * Long-running supervisor — run under tmux. Ctrl+C stops all services.
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aol = path.join(root, 'tools/aol/bin/aol.mjs');

const SERVICES = [
  { id: 'api-gateway', workspace: '@rtp/api-gateway', port: 3000 },
  { id: 'refund-status', workspace: '@rtp/refund-status-service', port: 3001 },
  { id: 'transcript', workspace: '@rtp/transcript-service', port: 3002 },
  { id: 'analytics', workspace: '@rtp/analytics-service', port: 3003 }
];

const WORKERS = [
  { id: 'tds-worker', workspace: '@rtp/tds-worker' },
  { id: 'transcript-pull-worker', workspace: '@rtp/transcript-pull-worker' },
  { id: 'live-source-fetcher', workspace: '@rtp/live-source-fetcher' }
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check-only');
const servicesOnly = args.has('--services-only');
const noWorkers = args.has('--no-workers') || servicesOnly;

function log(msg) {
  console.log(`[start-all] ${msg}`);
}

async function probe(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
    const body = await res.json();
    return { ok: res.ok, body };
  } catch (error) {
    return { ok: false, error: String(error.message || error) };
  }
}

async function waitForHealth(port, id, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    const result = await probe(port);
    if (result.ok) return result;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { ok: false, error: `timeout waiting for ${id} on :${port}` };
}

function startService(service) {
  // Unset SERVICE_PORT so each service's defaultPort override wins.
  const env = { ...process.env };
  delete env.SERVICE_PORT;

  const child = spawn(process.execPath, [aol, 'run', '-w', service.workspace, 'start'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${service.id}] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${service.id}] ${chunk}`);
  });
  child.on('exit', (code, signal) => {
    log(`${service.id} exited code=${code} signal=${signal || ''}`);
  });

  return child;
}

async function runWorker(worker) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [aol, 'run', '-w', worker.workspace, 'start', '--', '--once'],
      { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c;
    });
    child.stderr.on('data', (c) => {
      stderr += c;
    });
    child.on('exit', (code) => {
      resolve({ id: worker.id, ok: code === 0, code, stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 500) });
    });
  });
}

async function writeStatus(status) {
  await mkdir(path.join(root, 'build'), { recursive: true });
  const file = path.join(root, 'build/platform-runtime-status.json');
  await writeFile(file, `${JSON.stringify(status, null, 2)}\n`);
  return file;
}

async function main() {
  if (checkOnly) {
    const health = [];
    for (const service of SERVICES) {
      health.push({ id: service.id, port: service.port, ...(await probe(service.port)) });
    }
    console.log(JSON.stringify({ mode: 'check-only', health }, null, 2));
    process.exitCode = health.every((h) => h.ok) ? 0 : 1;
    return;
  }

  log('Starting RTPSC Tax Platform (entirety)');
  log(`root=${root}`);

  const children = [];
  for (const service of SERVICES) {
    log(`starting ${service.id} on :${service.port}`);
    children.push({ service, child: startService(service) });
  }

  const health = [];
  for (const { service } of children) {
    const result = await waitForHealth(service.port, service.id);
    health.push({ id: service.id, port: service.port, ...result });
    log(result.ok ? `✓ ${service.id} healthy` : `✖ ${service.id} ${result.error}`);
  }

  const workers = [];
  if (!noWorkers) {
    for (const worker of WORKERS) {
      log(`running worker ${worker.id} --once`);
      const result = await runWorker(worker);
      workers.push({ id: result.id, ok: result.ok, code: result.code });
      log(result.ok ? `✓ ${worker.id} completed` : `✖ ${worker.id} exit=${result.code}`);
      if (result.stdout.trim()) {
        console.log(result.stdout.trim().split('\n').slice(0, 8).join('\n'));
        console.log('…');
      }
    }
  }

  const status = {
    startedAt: new Date().toISOString(),
    mode: 'entirety',
    services: health,
    workers,
    endpoints: SERVICES.map((s) => ({
      id: s.id,
      health: `http://127.0.0.1:${s.port}/health`,
      metadata: `http://127.0.0.1:${s.port}/metadata`
    })),
    allServicesHealthy: health.every((h) => h.ok),
    allWorkersOk: noWorkers ? null : workers.every((w) => w.ok)
  };

  const statusFile = await writeStatus(status);
  log(`status → ${statusFile}`);
  console.log('');
  console.log('Platform runtime');
  console.log('────────────────');
  for (const ep of status.endpoints) {
    console.log(`  ${ep.id.padEnd(16)} ${ep.health}`);
  }
  console.log('');
  console.log('Supervisor running — Ctrl+C to stop all services.');

  const shutdown = (signal) => {
    log(`received ${signal} — stopping services`);
    for (const { child, service } of children) {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      log(`stopped ${service.id}`);
    }
    setTimeout(() => process.exit(status.allServicesHealthy ? 0 : 1), 300);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep alive while children run
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(`[start-all] fatal: ${error.message || error}`);
  process.exit(1);
});
