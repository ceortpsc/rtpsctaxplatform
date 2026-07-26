import { fileURLToPath } from 'node:url';
import {
  createServiceDescriptor,
  startHttpService,
  packageDir
} from '../../../packages/platform-core/src/index.mjs';
import {
  governanceBanner,
  listCatalog,
  listPersonasLive,
  createHireRequest,
  authenticateTask,
  scopeTask,
  priceTask,
  payTask,
  queueTask,
  runPersonaStep,
  humanApprove,
  placeHold,
  listTasks,
  listEvents,
  taskStates
} from '../../../packages/ero-governance/src/index.mjs';
import { hireAndRunLiveService, runtimeSnapshot } from '../../../engines/ai-persona-runtime/src/index.mjs';

export const aiWorkforceHubDescriptor = createServiceDescriptor({
  name: 'ai-workforce-hub',
  domain: 'ai-workforce',
  responsibilities: [
    'Expose realtime AI persona employee roster under RTP-AI-001.',
    'Offer paid practitioner-for-hire catalog with payment-gated execution.',
    'Enforce ERO / IRM-style HOLD and human-review gates.',
    'Provide operator UI for hire, pay, run, and audit events.'
  ],
  dependencies: ['api-gateway']
});

export function start(options = {}) {
  const staticDir = packageDir(import.meta.url, '../public');

  return startHttpService({
    descriptor: aiWorkforceHubDescriptor,
    defaultPort: options.port ?? 8860,
    staticDir,
    extraMetadata: {
      governance: governanceBanner(),
      ui: '/',
      taskStates: taskStates()
    },
    routes: {
      'GET /v1/governance': ({ response, sendJson }) => {
        sendJson(response, 200, governanceBanner());
      },
      'GET /v1/personas': ({ response, sendJson }) => {
        sendJson(response, 200, { personas: listPersonasLive() });
      },
      'GET /v1/catalog': ({ response, sendJson, url }) => {
        const category = url.searchParams.get('category') || undefined;
        sendJson(response, 200, { catalog: listCatalog({ category }) });
      },
      'GET /v1/tasks': ({ response, sendJson }) => {
        sendJson(response, 200, { tasks: listTasks() });
      },
      'GET /v1/events': ({ response, sendJson, url }) => {
        const limit = Number(url.searchParams.get('limit') || 50);
        sendJson(response, 200, { events: listEvents({ limit }) });
      },
      'GET /v1/runtime': ({ response, sendJson }) => {
        sendJson(response, 200, runtimeSnapshot());
      },
      'POST /v1/hire': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        if (body.ssn || body.tin || body.primarySsn) {
          sendJson(response, 400, {
            error: 'sensitive_identifier_rejected',
            message: 'Do not post full SSN/TIN. Use clientReference only.'
          });
          return;
        }
        const result = createHireRequest(body);
        sendJson(response, result.ok ? 201 : 400, result);
      },
      'POST /v1/tasks/authenticate': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        sendJson(response, 200, authenticateTask(body.taskId));
      },
      'POST /v1/tasks/scope': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        sendJson(response, 200, scopeTask(body.taskId, body.scopeNotes));
      },
      'POST /v1/tasks/price': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        sendJson(response, 200, priceTask(body.taskId));
      },
      'POST /v1/tasks/pay': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        const result = payTask(body.taskId, { method: body.method, reference: body.reference });
        sendJson(response, result.ok ? 200 : 400, result);
      },
      'POST /v1/tasks/queue': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        sendJson(response, 200, queueTask(body.taskId));
      },
      'POST /v1/tasks/run': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        const result = runPersonaStep(body.taskId, { action: body.action, message: body.message });
        sendJson(response, result.ok ? 200 : 409, result);
      },
      'POST /v1/tasks/human-approve': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        const result = humanApprove(body.taskId, { reviewer: body.reviewer, note: body.note });
        sendJson(response, result.ok ? 200 : 400, result);
      },
      'POST /v1/tasks/hold': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        sendJson(response, 200, placeHold(body.taskId, body.reason));
      },
      'POST /v1/live-service': async ({ request, response, readJsonBody, sendJson }) => {
        const body = await readJsonBody(request);
        if (body.ssn || body.tin) {
          sendJson(response, 400, { error: 'sensitive_identifier_rejected' });
          return;
        }
        const result = hireAndRunLiveService(body);
        sendJson(response, result.ok ? 201 : 400, result);
      }
    },
    onReady: ({ config }) => {
      console.log(`AI Workforce Hub running on port ${config.servicePort}`);
      console.log(`UI: http://127.0.0.1:${config.servicePort}/`);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
