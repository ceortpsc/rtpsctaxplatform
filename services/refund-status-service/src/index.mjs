import { fileURLToPath } from 'node:url';
import { createServiceDescriptor, startHttpService } from '../../../packages/platform-core/src/index.mjs';

export const refundStatusDescriptor = createServiceDescriptor({
  name: 'refund-status-service',
  domain: 'refund-status',
  responsibilities: [
    'Model refund status events from approved sources.',
    'Publish state transitions for downstream analytics.',
    'Enforce no-scraping policy in integration design.'
  ],
  dependencies: ['refund-status-pipeline', 'refund-intelligence-engine']
});

export function start() {
  return startHttpService({
    descriptor: refundStatusDescriptor,
    defaultPort: 3001,
    extraMetadata: {
      channels: ['refund.status.received', 'refund.status.updated', 'refund.status.escalated'],
      ingestionPolicy: 'Approved event sources only; no scraping.'
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
