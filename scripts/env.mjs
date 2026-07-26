import { evaluateEnvironmentProtection, PLATFORM_IDENTITY } from '../packages/platform-core/src/index.mjs';

console.log(JSON.stringify({ identity: PLATFORM_IDENTITY, ...evaluateEnvironmentProtection() }, null, 2));
