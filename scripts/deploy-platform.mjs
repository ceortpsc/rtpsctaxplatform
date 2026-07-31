#!/usr/bin/env node
/**
 * Full-platform deploy orchestrator for RTPSC + ROSS.CO Infinite.
 *
 * Provisions and verifies:
 *  1. Gates: lint → test → build (skippable)
 *  2. SEO DNS/token artifact deploy
 *  3. ROSS.CO Infinite doctor + evidence
 *  4. All HTTP services + registry + presence static + workflow-runner
 *  5. One-shot workers
 *  6. Health smoke + deployment manifest under build/
 *
 * Usage:
 *   node scripts/deploy-platform.mjs --smoke
 *   node scripts/deploy-platform.mjs --smoke --skip-gates
 *   node scripts/deploy-platform.mjs                 # stay live
 *   ./rtpsc deploy:full --smoke
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile, readFile, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const smoke = args.has('--smoke');
const skipGates = args.has('--skip-gates');
const skipWorkers = args.has('--skip-workers');

const SERVICES = [
  { name: 'api-gateway', entry: 'services/api-gateway/src/index.mjs', port: 3000 },
  { name: 'refund-status-service', entry: 'services/refund-status-service/src/index.mjs', port: 3001 },
  { name: 'transcript-service', entry: 'services/transcript-service/src/index.mjs', port: 3002 },
  { name: 'analytics-service', entry: 'services/analytics-service/src/index.mjs', port: 3003 },
  { name: 'enrollment-service', entry: 'services/enrollment-service/src/index.mjs', port: 3004 },
  { name: 'invoice-service', entry: 'services/invoice-service/src/index.mjs', port: 3005 },
  { name: 'pos-crm-service', entry: 'services/pos-crm-service/src/index.mjs', port: 3006 },
  { name: 'modules-dashboard', entry: 'services/modules-dashboard/src/index.mjs', port: 3010 },
  { name: 'irs-gateway', entry: 'services/irs-gateway/src/index.mjs', port: 8820 },
  { name: 'ai-workforce-hub', entry: 'services/ai-workforce-hub/src/index.mjs', port: 8860 }
];

const WORKERS_BACKGROUND = [{ name: 'workflow-runner', entry: 'workers/workflow-runner/src/index.mjs' }];

const WORKERS_ONESHOT = [
  { name: 'tds-worker', entry: 'workers/tds-worker/src/index.mjs', args: ['--once'] },
  { name: 'transcript-pull-worker', entry: 'workers/transcript-pull-worker/src/index.mjs', args: ['--once'] },
  { name: 'live-source-fetcher', entry: 'workers/live-source-fetcher/src/index.mjs', args: ['--once'] }
];

const children = [];
const provisions = [];

function log(msg) {
  console.log(`[deploy-platform] ${msg}`);
}

function prefixLines(prefix, buffer) {
  return (
    buffer
      .toString()
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => `${prefix} ${line}`)
      .join('\n') + '\n'
  );
}

function launchNode(component, extraArgs = []) {
  const env = { ...process.env };
  delete env.SERVICE_PORT;
  if (component.port) env.PORT = String(component.port);
  const child = spawn(process.execPath, [path.join(root, component.entry), ...extraArgs], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const prefix = `[${component.name}]`;
  child.stdout.on('data', (data) => process.stdout.write(prefixLines(prefix, data)));
  child.stderr.on('data', (data) => process.stderr.write(prefixLines(prefix, data)));
  child.on('exit', (code) => console.log(`${prefix} exited (code ${code}).`));
  children.push({ ...component, child });
  return child;
}

async function waitHealthy(port, attempts = 50, delayMs = 300) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body.status === 'ok' || body.ok === true) return { ok: true, body };
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false };
}

async function runCommand(label, command, commandArgs, { optional = false } = {}) {
  log(`provision: ${label}`);
  const started = Date.now();
  const result = await new Promise((resolve) => {
    const child = spawn(command, commandArgs, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
      process.stderr.write(d);
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
  const entry = {
    id: label,
    ok: result.code === 0,
    optional,
    code: result.code,
    durationMs: Date.now() - started
  };
  provisions.push(entry);
  if (!entry.ok && !optional) {
    throw new Error(`Provision failed: ${label} (exit ${result.code})`);
  }
  return entry;
}

async function provisionArtifacts() {
  if (!skipGates) {
    await runCommand('lint', process.execPath, [path.join(root, 'scripts/lint.mjs')]);
    await runCommand('test', process.execPath, ['--test']);
    await runCommand('build', 'bash', [path.join(root, 'scripts/build.sh')]);
  } else {
    provisions.push({ id: 'gates', ok: true, skipped: true });
  }

  await runCommand('seo-dns-token-deploy', process.execPath, [
    path.join(root, 'tools/ross-infinite/src/cli.mjs'),
    'seo',
    'deploy',
    'config/seo/ross.co.ownership.json',
    '--json'
  ]);

  await runCommand('ross-infinite-doctor', process.execPath, [
    path.join(root, 'tools/ross-infinite/src/cli.mjs'),
    'doctor',
    path.join(root, 'tools/ross-infinite'),
    '--json'
  ]);

  await runCommand(
    'ross-infinite-evidence',
    'bash',
    [path.join(root, 'tools/ross-infinite/scripts/build-v1-evidence.sh')],
    { optional: false }
  );

  // Ensure deploy stubs exist for k8s/terraform packaging
  await ensureRossInfiniteDeployProvisions();
  provisions.push({ id: 'ross-infinite-deploy-provisions', ok: true });
}

async function ensureRossInfiniteDeployProvisions() {
  const files = {
    'tools/ross-infinite/deploy/k8s/namespace.yaml': `apiVersion: v1
kind: Namespace
metadata:
  name: ross-infinite
  labels:
    app.kubernetes.io/part-of: rtpsc
    app.kubernetes.io/name: ross-infinite
`,
    'tools/ross-infinite/deploy/k8s/deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ross-infinite-registry
  namespace: ross-infinite
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ross-infinite-registry
  template:
    metadata:
      labels:
        app: ross-infinite-registry
    spec:
      containers:
        - name: registry
          image: ross-infinite:1.0.0
          ports:
            - containerPort: 4873
          env:
            - name: PORT
              value: "4873"
            - name: ROSS_REGISTRY_DATA
              value: /data
          readinessProbe:
            httpGet:
              path: /health
              port: 4873
          livenessProbe:
            httpGet:
              path: /health
              port: 4873
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: ross-infinite-registry
  namespace: ross-infinite
spec:
  selector:
    app: ross-infinite-registry
  ports:
    - port: 4873
      targetPort: 4873
`,
    'tools/ross-infinite/deploy/terraform/main.tf': `terraform {
  required_version = ">= 1.5.0"
}

variable "registry_port" {
  type    = number
  default = 4873
}

output "ross_infinite_registry_port" {
  value = var.registry_port
}

# Scaffold baseline — extend with cloud resources when credentials are provisioned.
`,
    'tools/ross-infinite/deploy/scripts/deploy.sh': `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
echo "ROSS.CO Infinite local deploy provisions"
node tools/ross-infinite/src/cli.mjs doctor tools/ross-infinite
node tools/ross-infinite/src/cli.mjs seo deploy config/seo/ross.co.ownership.json
echo "Optional: kubectl apply -f tools/ross-infinite/deploy/k8s/"
`,
    'tools/ross-infinite/openapi/registry.openapi.yaml': `openapi: 3.0.3
info:
  title: ROSS.CO Infinite Registry
  version: 1.0.0
paths:
  /health:
    get:
      summary: Health
      responses:
        '200':
          description: OK
  /metadata:
    get:
      summary: Service metadata
      responses:
        '200':
          description: OK
  /-/ping:
    get:
      summary: Ping
      responses:
        '200':
          description: OK
  /-/publish:
    post:
      summary: Publish package metadata
      responses:
        '201':
          description: Created
`
  };

  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    try {
      await access(abs);
      const current = await readFile(abs, 'utf8');
      if (!current.trim()) await writeFile(abs, body, 'utf8');
    } catch {
      await writeFile(abs, body, 'utf8');
    }
  }
  // ensure deploy.sh executable bit via content write is enough for bash invocation
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json') || filePath.endsWith('.jsonld')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (filePath.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

async function startPresenceStatic(port = 3080) {
  const siteRoot = path.join(root, 'presence/rossco');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      if (url.pathname === '/health') {
        const body = JSON.stringify({ status: 'ok', service: 'rossco-presence', root: 'presence/rossco' });
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
        res.end(body);
        return;
      }
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/index.html';
      const filePath = path.join(siteRoot, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
      if (!filePath.startsWith(siteRoot)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, { 'content-type': contentType(filePath), 'content-length': data.length });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  children.push({
    name: 'rossco-presence',
    port,
    child: {
      kill() {
        server.close();
      }
    }
  });
  return { name: 'rossco-presence', port };
}

async function startRossRegistry(port = 4873) {
  const dataDir = path.join(root, '.ross', 'registry-deploy');
  await mkdir(dataDir, { recursive: true });
  const child = spawn(
    process.execPath,
    [path.join(root, 'tools/ross-infinite/src/server/registry.mjs')],
    {
      cwd: root,
      env: { ...process.env, PORT: String(port), ROSS_REGISTRY_DATA: dataDir },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  child.stdout.on('data', (d) => process.stdout.write(prefixLines('[ross-infinite-registry]', d)));
  child.stderr.on('data', (d) => process.stderr.write(prefixLines('[ross-infinite-registry]', d)));
  children.push({ name: 'ross-infinite-registry', port, child });
  return { name: 'ross-infinite-registry', port };
}

async function runOneShotWorkers() {
  if (skipWorkers) {
    provisions.push({ id: 'oneshot-workers', ok: true, skipped: true });
    return [];
  }
  const results = [];
  for (const worker of WORKERS_ONESHOT) {
    const started = Date.now();
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(root, worker.entry), ...(worker.args || [])], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.on('data', (d) => process.stdout.write(prefixLines(`[${worker.name}]`, d)));
      child.stderr.on('data', (d) => process.stderr.write(prefixLines(`[${worker.name}]`, d)));
      child.on('close', (c) => resolve(c ?? 1));
    });
    results.push({ name: worker.name, ok: code === 0, code, durationMs: Date.now() - started });
  }
  provisions.push({
    id: 'oneshot-workers',
    ok: results.every((r) => r.ok),
    results
  });
  return results;
}

function shutdown(code) {
  for (const entry of children) {
    try {
      entry.child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

async function writeManifest(status) {
  const outDir = path.join(root, 'build');
  await mkdir(outDir, { recursive: true });
  const body = `${JSON.stringify(status, null, 2)}\n`;
  const digest = createHash('sha256').update(body).digest('hex');
  const outPath = path.join(outDir, 'platform-deploy-manifest.json');
  await writeFile(outPath, body, 'utf8');
  await writeFile(path.join(outDir, 'platform-deploy-manifest.sha256'), `${digest}  platform-deploy-manifest.json\n`);
  return { outPath, digest };
}

async function main() {
  log('Full RTPSC + ROSS.CO Infinite deploy starting…');
  await provisionArtifacts();

  log('Launching HTTP services…');
  for (const service of SERVICES) launchNode(service);
  for (const worker of WORKERS_BACKGROUND) launchNode(worker);

  const registry = await startRossRegistry(4873);
  const presence = await startPresenceStatic(3080);

  const healthTargets = [
    ...SERVICES,
    registry,
    presence
  ];

  const health = [];
  for (const target of healthTargets) {
    const result = await waitHealthy(target.port);
    health.push({ name: target.name, port: target.port, healthy: result.ok });
  }

  const workerResults = await runOneShotWorkers();

  console.log('\n════════════ FULL PLATFORM DEPLOYMENT STATUS ════════════');
  for (const row of health) {
    console.log(`${row.healthy ? '✓' : '✗'}  ${row.name.padEnd(24)} http://127.0.0.1:${row.port}/health`);
  }
  for (const worker of WORKERS_BACKGROUND) {
    console.log(`•  ${worker.name.padEnd(24)} background`);
  }
  for (const row of workerResults) {
    console.log(`${row.ok ? '✓' : '✗'}  ${row.name.padEnd(24)} oneshot exit=${row.code}`);
  }
  console.log('═════════════════════════════════════════════════════════\n');

  const allHealthy = health.every((h) => h.healthy);
  const provisionsOk = provisions.every((p) => p.ok || p.optional || p.skipped);
  const status = {
    product: 'RTPSC Tax Platform + ROSS.CO Infinite',
    mode: smoke ? 'smoke' : 'live',
    deployedAt: new Date().toISOString(),
    ok: allHealthy && provisionsOk,
    provisions,
    health,
    workersBackground: WORKERS_BACKGROUND.map((w) => w.name),
    workersOneshot: workerResults,
    artifacts: {
      seo: 'deploy/seo',
      presence: 'presence/rossco',
      rossInfinite: 'tools/ross-infinite',
      evidence: 'tools/ross-infinite/release-evidence/v1'
    }
  };
  const manifest = await writeManifest(status);
  log(`manifest → ${path.relative(root, manifest.outPath)} (${manifest.digest.slice(0, 12)}…)`);

  if (!status.ok) {
    log('Deploy incomplete — see status table.');
    if (smoke) shutdown(1);
  } else {
    log(`All ${health.length} endpoints healthy; provisions ok.`);
  }

  if (smoke) {
    log('Smoke complete — shutting down.');
    shutdown(status.ok ? 0 : 1);
    return;
  }

  log('Platform is live. Press Ctrl+C to stop.');
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

main().catch((error) => {
  console.error(`[deploy-platform] ${error.message}`);
  shutdown(1);
});
