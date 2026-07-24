import { describeWorkflow } from '../../../packages/workflow-engine/src/index.mjs';
import { createPlatformRegistry } from './registry.mjs';

// Terminal task runner for modular workflows.
//   node src/cli.mjs list
//   node src/cli.mjs run <workflow-name> '<json-input>'
//   node src/cli.mjs emit <event-name> '<json-payload>'

async function main() {
  const [command, target, rawPayload] = process.argv.slice(2);
  const { registry, runner, triggers } = createPlatformRegistry();

  if (!command || command === 'list') {
    const workflows = registry.list().map(describeWorkflow);
    console.log(JSON.stringify({ workflows }, null, 2));
    return;
  }

  let payload = {};
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      console.error('Payload must be valid JSON.');
      process.exitCode = 1;
      return;
    }
  }

  if (command === 'run') {
    if (!target || !registry.has(target)) {
      console.error(`Unknown workflow "${target}". Available: ${registry.list().map((w) => w.name).join(', ')}`);
      process.exitCode = 1;
      return;
    }
    const record = await triggers.fireManual(target, payload);
    console.log(JSON.stringify(record, null, 2));
    process.exitCode = record.status === 'failed' ? 1 : 0;
    return;
  }

  if (command === 'emit') {
    if (!target) {
      console.error('An event name is required: node src/cli.mjs emit <event-name> [json-payload]');
      process.exitCode = 1;
      return;
    }
    const records = await triggers.emit(target, payload);
    console.log(JSON.stringify({ event: target, triggered: records.length, runs: records }, null, 2));
    return;
  }

  console.error(`Unknown command "${command}". Use: list | run | emit`);
  process.exitCode = 1;
}

main();
