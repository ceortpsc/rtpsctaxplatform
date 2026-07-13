import { fileURLToPath } from 'node:url';
import { createServiceDescriptor, startHttpService } from '../../../packages/platform-core/src/index.mjs';

export const analyticsDescriptor = createServiceDescriptor({
  name: 'analytics-service',
  domain: 'analytics',
  responsibilities: [
    'Aggregate refund intelligence and analytics center outputs.',
    'Provide TC code indicator metadata.',
    'Expose operational metadata for downstream observability.'
  ],
  dependencies: ['analytics-center', 'refund-intelligence-engine', 'tc-code-engine']
});

export function start() {
  return startHttpService({
    descriptor: analyticsDescriptor,
    defaultPort: 3003,
    extraMetadata: {
      dashboards: ['refund-intelligence', 'operations-overview', 'tc-code-indicators'],
      engines: ['analytics-center', 'refund-intelligence-engine', 'tc-code-engine']
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
