import { fileURLToPath } from 'node:url';
import { createServiceDescriptor, startHttpService } from '../../../packages/platform-core/src/index.mjs';
import { masterfilePipeline } from '../../../pipelines/masterfile-pipeline/src/index.mjs';
import { enrichMasterfile } from '../../../engines/tc-code-engine/src/index.mjs';
import { planFill } from '../../../engines/pdf-fill-engine/src/index.mjs';

export const transcriptDescriptor = createServiceDescriptor({
  name: 'transcript-service',
  domain: 'transcripts',
  responsibilities: [
    'Coordinate account transcript pull requests.',
    'Own TDS and masterfile orchestration metadata.',
    'Route approved transcript events into processing pipelines.',
    'Expose pull catalog and enrichment APIs for operators.'
  ],
  dependencies: ['transcript-pull-worker', 'tds-worker', 'masterfile-pipeline', 'tc-code-engine', 'pdf-fill-engine']
});

const pulls = new Map();

function createPull(body = {}) {
  const id = `pull_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    status: 'queued',
    taxYear: body.taxYear || null,
    product: body.product || 'account-transcript',
    tcCodes: body.tcCodes || [],
    createdAt: new Date().toISOString(),
    enrichment: enrichMasterfile({
      id,
      taxYear: body.taxYear,
      tcCodes: body.tcCodes || []
    }),
    fillPlan: body.fields
      ? planFill({ template: body.template || 'forms/templates', fields: body.fields })
      : null,
    pipeline: {
      name: masterfilePipeline.name,
      stages: masterfilePipeline.stages,
      outputs: masterfilePipeline.outputs
    }
  };
  pulls.set(id, record);
  return record;
}

export function start() {
  return startHttpService({
    descriptor: transcriptDescriptor,
    defaultPort: 3002,
    extraMetadata: {
      workers: ['transcript-pull-worker', 'tds-worker'],
      dataProducts: ['account-transcript', 'masterfile-record', 'tds-packet'],
      engines: ['tc-code-engine', 'pdf-fill-engine'],
      routes: ['GET /api/catalog', 'GET /api/pulls', 'POST /api/pulls']
    },
    routes: {
      'GET /api/catalog': ({ sendJson, response }) => {
        sendJson(response, 200, {
          service: transcriptDescriptor.name,
          products: [
            { id: 'account-transcript', label: 'Account Transcript' },
            { id: 'wage-income', label: 'Wage & Income' },
            { id: 'record-of-account', label: 'Record of Account' },
            { id: 'return-transcript', label: 'Return Transcript' }
          ],
          pipeline: masterfilePipeline,
          workers: ['transcript-pull-worker', 'tds-worker']
        });
      },
      'GET /api/pulls': ({ sendJson, response }) => {
        sendJson(response, 200, {
          count: pulls.size,
          pulls: [...pulls.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        });
      },
      'POST /api/pulls': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        const record = createPull(body);
        sendJson(response, 201, record);
      }
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
