import { fileURLToPath } from 'node:url';
import { loadRuntimeConfig } from '../../../packages/platform-core/src/index.mjs';
import { createPlatformRegistry, sampleInputs } from './registry.mjs';

// Background workflow runner. Workflows are executed here (never triggered from a
// dashboard): scheduled workflows fire on their own timers, and event/manual
// workflows are driven on a background cycle. Every completed run is logged.

const BACKGROUND_CYCLE_MS = Number(process.env.WORKFLOW_CYCLE_MS ?? 15000);

function summarize(record) {
  return {
    id: record.id,
    workflow: record.workflow,
    trigger: record.trigger,
    status: record.status,
    durationMs: record.durationMs,
    error: record.error
  };
}

async function runCycle(registry, triggers, { includeScheduled = false } = {}) {
  const records = [];
  for (const workflow of registry.list()) {
    const input = sampleInputs[workflow.name] ?? {};
    if (workflow.trigger.type === 'event') {
      records.push(...(await triggers.emit(workflow.trigger.on, input)));
    } else if (workflow.trigger.type === 'manual' || includeScheduled) {
      records.push(await triggers.fireManual(workflow.name, input));
    }
  }
  return records;
}

export function start() {
  const config = loadRuntimeConfig();
  const { registry, runner, triggers } = createPlatformRegistry();

  if (process.argv.includes('--once')) {
    return runCycle(registry, triggers, { includeScheduled: true }).then((records) => {
      console.log(
        JSON.stringify(
          { worker: 'workflow-runner', mode: 'once', environment: config.appEnv, runs: records.map(summarize) },
          null,
          2
        )
      );
      return records;
    });
  }

  console.log(`workflow-runner started in ${config.appEnv} mode (background). Press Ctrl+C to stop.`);

  runner.onChange((record) => {
    if (record.status !== 'running') {
      console.log(JSON.stringify({ event: 'workflow.run.completed', ...summarize(record) }));
    }
  });

  // Scheduled workflows (e.g. transmission-cycle) fire on their own timers.
  triggers.startSchedules();

  // Drive event + manual workflows in the background on a fixed cadence. This
  // timer is intentionally NOT unref'd so the runner stays alive as a service.
  const timer = setInterval(() => {
    runCycle(registry, triggers).catch((error) => console.error('background cycle error:', error.message));
  }, BACKGROUND_CYCLE_MS);

  // Kick off one immediate cycle so activity is visible right away.
  runCycle(registry, triggers).catch(() => {});

  const stop = () => {
    clearInterval(timer);
    triggers.stopSchedules();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  return { registry, runner, triggers, stop };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
