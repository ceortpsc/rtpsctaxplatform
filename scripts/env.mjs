import { evaluateEnvironmentProtection, PLATFORM_IDENTITY, resolveChannelFromEnv } from '../packages/platform-core/src/index.mjs';

console.log(
  JSON.stringify(
    {
      identity: PLATFORM_IDENTITY,
      releaseChannel: resolveChannelFromEnv(),
      ...evaluateEnvironmentProtection()
    },
    null,
    2
  )
);
