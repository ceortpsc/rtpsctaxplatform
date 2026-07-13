import { createPipelineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const masterfilePipeline = createPipelineDescriptor({
  name: 'masterfile-pipeline',
  stages: ['ingest-approved-record', 'normalize-masterfile', 'enrich-tax-indicators', 'publish-canonical-event'],
  outputs: ['canonical-masterfile-record', 'indicator-event']
});
