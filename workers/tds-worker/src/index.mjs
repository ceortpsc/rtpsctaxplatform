import { fileURLToPath } from 'node:url';
import {
  createWorkerDescriptor,
  loadRuntimeConfig,
  redactConfig,
  evaluateEnvironmentProtection
} from '../../../packages/platform-core/src/index.mjs';
import { createClientRegistry } from '../../../packages/client-identity/src/index.mjs';

export const tdsWorkerDescriptor = createWorkerDescriptor({
  name: 'tds-worker',
  responsibilities: [
    'Authenticate with a full TDS client id/secret before any pull job.',
    'Coordinate approved TDS pull jobs (simulated — no live IRS).',
    'Normalize TDS payload delivery and emit refund ingest checkpoints.'
  ]
});

/**
 * One-shot / heartbeat TDS worker that validates TDS client credentials and
 * optionally posts a simulated refund event to the refund-status service.
 */
export async function runTdsJob({
  registry,
  env = process.env,
  refundUrl = env.REFUND_STATUS_URL ?? 'http://localhost:3001',
  emitRefund = true
} = {}) {
  const config = loadRuntimeConfig();
  const clients = registry ?? createClientRegistry({ env });
  await clients.loadPersisted();
  clients.seedFromEnv();
  await clients.ensureLocalClients();

  const tds = clients.listClients({ kind: 'tds' }).find((c) => c.status === 'active');
  if (!tds) {
    return {
      worker: tdsWorkerDescriptor.name,
      status: 'blocked',
      reason: 'No active TDS client provisioned.',
      environmentProtection: evaluateEnvironmentProtection(config)
    };
  }

  // Authenticate using env secret when present; otherwise read from issued registry
  // by re-issuing is impossible — for local-auto clients we authenticate via a
  // bootstrap path: if env TDS secret set, use it; else skip network emit and report.
  const tdsSecret = env.TDS_CLIENT_SECRET && env.TDS_CLIENT_SECRET !== 'unset' ? env.TDS_CLIENT_SECRET : null;
  let auth = null;
  if (tdsSecret) {
    auth = await clients.authenticate({
      clientId: env.TDS_CLIENT_ID || tds.id,
      clientSecret: tdsSecret,
      kind: 'tds',
      requiredScope: 'tds:pull',
      meta: { source: 'tds-worker' }
    });
  }

  const steps = [
    { name: 'load-approved-config', ok: true },
    { name: 'authenticate-tds-client', ok: Boolean(auth?.ok) || !tdsSecret, detail: auth?.ok ? 'authenticated' : tdsSecret ? auth?.message : 'local client present (set TDS_CLIENT_SECRET to authenticate)' },
    { name: 'request-tds-job', ok: true, detail: 'simulated approved TDS job (no live IRS)' },
    { name: 'normalize-response', ok: true, detail: 'normalized transcript/refund checkpoint packet' }
  ];

  let emitResult = null;
  if (emitRefund && auth?.ok) {
    try {
      const response = await fetch(`${refundUrl}/api/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-client-id': env.TDS_CLIENT_ID || tds.id,
          'x-api-client-secret': tdsSecret
        },
        body: JSON.stringify({
          caseId: `CASE-TDS-${Date.now().toString(36).toUpperCase()}`,
          taxpayerRef: 'TP-TDS',
          filingStage: 'processing',
          source: 'tds-worker',
          hasTranscript: true
        })
      });
      emitResult = await response.json();
      steps.push({ name: 'emit-events', ok: response.ok, detail: response.ok ? 'refund.status.received posted' : emitResult.message });
    } catch (error) {
      steps.push({ name: 'emit-events', ok: false, detail: error.message });
    }
  } else {
    steps.push({ name: 'emit-events', ok: true, detail: 'skipped (authenticate TDS client with env secret to emit)' });
  }

  return {
    worker: tdsWorkerDescriptor.name,
    runtime: redactConfig(config),
    environmentProtection: evaluateEnvironmentProtection(config),
    tdsClient: tds,
    authenticated: Boolean(auth?.ok),
    steps,
    emitResult
  };
}

export function start() {
  const once = process.argv.includes('--once');
  const job = runTdsJob();
  return Promise.resolve(job).then((output) => {
    console.log(JSON.stringify(output, null, 2));
    if (!once) {
      console.log(`${tdsWorkerDescriptor.name} completed one cycle. Use --once for CI; long-running mode not required.`);
    }
    return output;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await start();
}
