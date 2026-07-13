import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const analyticsCenter = createEngineDescriptor({
  name: 'analytics-center',
  capabilities: ['metric-aggregation', 'dashboard-feed-generation', 'pipeline-throughput-reporting'],
  outputs: ['operations-dashboard', 'analytics-feed']
});
