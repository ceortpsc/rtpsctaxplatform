import { fileURLToPath } from 'node:url';
import { createServiceDescriptor, startHttpService } from '../../../packages/platform-core/src/index.mjs';
import { clientIdentityPlaceholders } from '../../../packages/client-config/src/index.mjs';
import { createSecureTunnelAdapter } from '../../../packages/secure-tunnel/src/index.mjs';

export const gatewayDescriptor = createServiceDescriptor({
  name: 'api-gateway',
  domain: 'ingress',
  responsibilities: [
    'Expose gateway health and metadata routes.',
    'Own transmission route registration and compliance disclaimers.',
    'Declare approved secure tunnel prerequisites.'
  ],
  dependencies: ['refund-status-service', 'transcript-service', 'analytics-service']
});

export function start() {
  return startHttpService({
    descriptor: gatewayDescriptor,
    defaultPort: 3000,
    extraMetadata: {
      transmissionFlows: ['prepare', 'validate', 'queue', 'transmit', 'acknowledge'],
      secureTunnel: createSecureTunnelAdapter(),
      credentialPlaceholders: clientIdentityPlaceholders
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
