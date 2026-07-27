import { fileURLToPath } from 'node:url';
import { createServiceDescriptor, startHttpService } from '../../../packages/platform-core/src/index.mjs';
import {
  analyticsCenter,
  aggregateMetrics,
  buildAnalyticsFeed,
  reportPipelineThroughput
} from '../../../engines/analytics-center/src/index.mjs';
import { buildRefundIntelligence } from '../../../engines/refund-intelligence-engine/src/index.mjs';
import {
  tcCodeEngine,
  listTcCodes,
  lookupTcCode,
  enrichMasterfile
} from '../../../engines/tc-code-engine/src/index.mjs';

export const analyticsDescriptor = createServiceDescriptor({
  name: 'analytics-service',
  domain: 'analytics',
  responsibilities: [
    'Aggregate refund intelligence and analytics center outputs.',
    'Provide TC code indicator metadata.',
    'Expose operational metrics and dashboard feed APIs.'
  ],
  dependencies: ['analytics-center', 'refund-intelligence-engine', 'tc-code-engine']
});

function sampleFeed(body = {}) {
  const intelligence =
    body.intelligence ||
    (body.signals || body.roi
      ? buildRefundIntelligence({ signals: body.signals || {}, roi: body.roi || body })
      : null);
  return buildAnalyticsFeed({
    ...body,
    intelligence
  });
}

export function start() {
  return startHttpService({
    descriptor: analyticsDescriptor,
    defaultPort: 3003,
    extraMetadata: {
      dashboards: ['refund-intelligence', 'operations-overview', 'tc-code-indicators'],
      engines: [analyticsCenter.name, 'refund-intelligence-engine', tcCodeEngine.name],
      routes: [
        'GET /api/feed',
        'GET /api/metrics',
        'GET /api/tc-codes',
        'POST /api/aggregate',
        'POST /api/tc-codes/enrich'
      ]
    },
    routes: {
      'GET /api/feed': ({ sendJson, response }) => {
        sendJson(response, 200, sampleFeed());
      },
      'GET /api/metrics': ({ sendJson, response }) => {
        sendJson(response, 200, aggregateMetrics());
      },
      'GET /api/tc-codes': ({ sendJson, response, url }) => {
        const code = url.searchParams.get('code');
        if (code) {
          const result = lookupTcCode(code);
          sendJson(response, result.ok ? 200 : 404, result);
          return;
        }
        const category = url.searchParams.get('category') || undefined;
        const holdParam = url.searchParams.get('hold');
        const hold = holdParam == null ? undefined : holdParam === 'true';
        const codes = listTcCodes({ category, hold });
        sendJson(response, 200, {
          engine: tcCodeEngine.name,
          count: codes.length,
          codes
        });
      },
      'POST /api/aggregate': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        const intelligence =
          body.includeIntelligence === false
            ? null
            : buildRefundIntelligence({ signals: body.signals || {}, roi: body.roi || {} });
        const feed = buildAnalyticsFeed({ ...body, intelligence });
        const throughput = body.stages ? reportPipelineThroughput(body.stages) : null;
        sendJson(response, 200, { feed, throughput });
      },
      'POST /api/tc-codes/enrich': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        sendJson(response, 200, enrichMasterfile(body));
      }
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
