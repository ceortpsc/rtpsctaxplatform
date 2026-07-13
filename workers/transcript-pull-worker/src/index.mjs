import { fileURLToPath } from 'node:url';
import { createWorkerDescriptor, runWorker } from '../../../packages/platform-core/src/index.mjs';

export const transcriptPullWorkerDescriptor = createWorkerDescriptor({
  name: 'transcript-pull-worker',
  responsibilities: [
    'Coordinate approved account transcript pulls.',
    'Queue masterfile and transcript normalization stages.',
    'Track transcript pull audit checkpoints.'
  ]
});

export function start() {
  return runWorker({
    descriptor: transcriptPullWorkerDescriptor,
    steps: ['load-transcript-request', 'request-approved-source', 'normalize-transcript', 'publish-events']
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
