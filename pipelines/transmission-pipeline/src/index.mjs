import { createPipelineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const transmissionPipeline = createPipelineDescriptor({
  name: 'transmission-pipeline',
  stages: ['prepare-payload', 'validate-controls', 'queue-transmission', 'handoff-approved-tunnel', 'process-acknowledgement'],
  outputs: ['transmission-packet', 'ack-event', 'rejection-event']
});
