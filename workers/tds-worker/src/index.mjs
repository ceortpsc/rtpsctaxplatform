import { fileURLToPath } from 'node:url';
import { createWorkerDescriptor, runWorker } from '../../../packages/platform-core/src/index.mjs';

export const tdsWorkerDescriptor = createWorkerDescriptor({
  name: 'tds-worker',
  responsibilities: [
    'Coordinate approved TDS pull jobs.',
    'Normalize TDS payload delivery into pipeline stages.',
    'Emit operational checkpoints for retry and escalation.'
  ]
});

export function start() {
  return runWorker({
    descriptor: tdsWorkerDescriptor,
    steps: ['load-approved-config', 'request-tds-job', 'normalize-response', 'emit-events']
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
