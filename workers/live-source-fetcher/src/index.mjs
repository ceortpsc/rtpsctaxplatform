import { fileURLToPath } from 'node:url';
import { createWorkerDescriptor, runWorker } from '../../../packages/platform-core/src/index.mjs';

export const liveSourceFetcherDescriptor = createWorkerDescriptor({
  name: 'live-source-fetcher',
  responsibilities: [
    'Poll or subscribe to approved live sources only.',
    'Reject scraping-based implementations.',
    'Emit normalized updates for refund and transcript pipelines.'
  ]
});

export function start() {
  return runWorker({
    descriptor: liveSourceFetcherDescriptor,
    steps: ['load-approved-source-config', 'fetch-live-update', 'validate-compliance', 'publish-approved-event']
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
