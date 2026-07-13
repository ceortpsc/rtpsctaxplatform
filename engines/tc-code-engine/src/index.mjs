import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const tcCodeEngine = createEngineDescriptor({
  name: 'tc-code-engine',
  capabilities: ['tc-code-catalog', 'indicator-tagging', 'masterfile-enrichment'],
  outputs: ['tc-code-indicator', 'analytics-tag']
});
