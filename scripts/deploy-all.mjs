// Deploy-all orchestrator for the RTPSC platform.
//
// Launches every HTTP service plus the background workflow-runner as child
// processes, prefixes their logs, and health-checks each service. Runs until
// interrupted; pass --smoke to verify health once, print a status table, and
// exit (useful for CI/local smoke checks).

import { spawn } from 'node:child_process';
import process from 'node:process';
import { PLATFORM_SERVICES } from '../packages/platform-core/src/registry.mjs';

const root = process.cwd();
const smoke = process.argv.includes('--smoke');
const appEnv = process.env.APP_ENV || 'local';

const services = PLATFORM_SERVICES.map((service) => ({
  name: service.name,
  entry: service.entry,
  port: service.port
}));

const workers = [
  { name: 'workflow-runner', entry: 'workers/workflow-runner/src/index.mjs' },
  { name: 'ai-persona-worker', entry: 'workers/ai-persona-worker/src/index.mjs' }
];

const children = [];

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

function launch(component) {
  const env = { ...process.env };
  delete env.SERVICE_PORT;
  const child = spawn(process.execPath, [component.entry], { cwd: root, env });
  const prefix = `[${component.name}]`;
  child.stdout.on('data', (data) => process.stdout.write(prefixLines(prefix, data)));
  child.stderr.on('data', (data) => process.stderr.write(prefixLines(prefix, data)));
  child.on('exit', (code) => console.log(`${prefix} process exited (code ${code}).`));
  children.push({ ...component, child });
}

async function waitHealthy(service, attempts = 40, delayMs = 400) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${service.port}/health`);
      if (response.ok) {
        const body = await response.json();
        if (body.status === 'ok') return true;
      }
    } catch {
      // service not up yet — retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
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

async function main() {
  console.log(`▶ Deploying all RTPSC platform components (APP_ENV=${appEnv})…\n`);
  [...services, ...workers].forEach(launch);

  const results = await Promise.all(services.map(async (service) => ({ service, healthy: await waitHealthy(service) })));

  console.log('\n════════════ DEPLOYMENT STATUS ════════════');
  for (const { service, healthy } of results) {
    const mark = healthy ? '✓' : '✗';
    const label = healthy ? 'HEALTHY' : 'UNAVAILABLE';
    console.log(`${mark}  ${service.name.padEnd(22)} http://localhost:${service.port}  ${label}`);
  }
  for (const worker of workers) {
    console.log(`•  ${worker.name.padEnd(22)} ${'background worker'.padEnd(24)} RUNNING`);
  }
  console.log('═══════════════════════════════════════════');

  const allHealthy = results.every((result) => result.healthy);
  console.log(
    allHealthy
      ? `\n✓ All ${services.length} services deployed and healthy; ${workers.length} background workers running.`
      : '\n✗ One or more services failed to become healthy.'
  );

  if (smoke) {
    console.log('Smoke check complete — shutting down.');
    shutdown(allHealthy ? 0 : 1);
    return;
  }

  console.log('\nPlatform is live. Press Ctrl+C to stop all components.');
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

main();
