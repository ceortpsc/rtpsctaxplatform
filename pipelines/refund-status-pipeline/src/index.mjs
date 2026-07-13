import { createPipelineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const refundStatusPipeline = createPipelineDescriptor({
  name: 'refund-status-pipeline',
  stages: ['ingest-approved-event', 'deduplicate', 'update-status-timeline', 'trigger-escalation-rules'],
  outputs: ['refund-status-timeline-event', 'refund-status-alert']
});
