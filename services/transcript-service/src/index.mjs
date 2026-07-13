import { fileURLToPath } from 'node:url';
import { createServiceDescriptor, startHttpService } from '../../../packages/platform-core/src/index.mjs';

export const transcriptDescriptor = createServiceDescriptor({
  name: 'transcript-service',
  domain: 'transcripts',
  responsibilities: [
    'Coordinate account transcript pull requests.',
    'Own TDS and masterfile orchestration metadata.',
    'Route approved transcript events into processing pipelines.'
  ],
  dependencies: ['transcript-pull-worker', 'tds-worker', 'masterfile-pipeline']
});

export function start() {
  return startHttpService({
    descriptor: transcriptDescriptor,
    defaultPort: 3002,
    extraMetadata: {
      workers: ['transcript-pull-worker', 'tds-worker'],
      dataProducts: ['account-transcript', 'masterfile-record', 'tds-packet']
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
