import { bootstrapEnv, loadRuntimeConfig, redactConfig, evaluateEnvironmentProtection } from '../packages/platform-core/src/index.mjs';
import { createSecureTunnelAdapter } from '../packages/secure-tunnel/src/index.mjs';

bootstrapEnv();
const config = loadRuntimeConfig();
const protection = evaluateEnvironmentProtection(config);
const tunnel = createSecureTunnelAdapter();

console.log(
  JSON.stringify(
    {
      identity: {
        company: 'Ross Tax Pro Software Co',
        application: 'Efile Transmission Software',
        abbreviation: 'RTPSC'
      },
      runtime: redactConfig(config),
      ...protection,
      tunnel: tunnel.describe()
    },
    null,
    2
  )
);
