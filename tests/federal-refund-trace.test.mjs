import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFullReportExport,
  buildFederalTraceTimeline,
  resolveAckStage,
  describeFederalRefundTraceModule
} from '../packages/federal-refund-trace/src/index.mjs';
import { createRefundStore } from '../packages/refund-core/src/index.mjs';
import {
  createGatewayCommsTunnelAdapter,
  probeGatewayCommsTunnel,
  openGatewayCommsSession,
  evaluateGatewayCommsProtection
} from '../packages/gateway-comms-tunnel/src/index.mjs';
import { createRefundStatusServer } from '../services/refund-status-service/src/index.mjs';
import { createClientRegistry } from '../packages/client-identity/src/index.mjs';

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'full-report-export.sample.csv'
);

test('resolveAckStage maps IRS ack letters', () => {
  assert.equal(resolveAckStage('A'), 'accepted');
  assert.equal(resolveAckStage('R'), 'rejected');
  assert.equal(resolveAckStage(''), null);
});

test('sample Full Report Export normalizes shifted columns and builds timeline', async () => {
  const csv = await readFile(fixturePath, 'utf8');
  const parsed = parseFullReportExport(csv);
  assert.equal(parsed.count, 1);
  const row = parsed.rows[0];
  assert.equal(row.shifted, true);
  assert.equal(row.firstName, 'ALICE');
  assert.equal(row.lastName, 'DEMO');
  assert.equal(row.lastFour, '1234');
  assert.equal(row.ackCode, 'A');
  assert.equal(row.refund, 2500);
  assert.equal(row.bankProduct, 'SBTPG RT Check');
  assert.ok(row.auditProduct);
  assert.ok(row.idTheftProduct);

  const trace = buildFederalTraceTimeline(row);
  const stages = trace.timeline.map((e) => e.stage);
  assert.ok(stages.includes('transmitted'));
  assert.ok(stages.includes('accepted'));
  assert.ok(stages.includes('funded'));
  assert.ok(stages.includes('fees_settled'));
  assert.ok(stages.includes('protections'));
  assert.ok(stages.includes('closed'));
  assert.ok(trace.timeline[0].phrase?.text || trace.timeline[0].phrase);
});

test('refund store ingestCase + runFullPath + ledger import', async () => {
  const store = createRefundStore();
  const csv = await readFile(fixturePath, 'utf8');
  const imported = await store.ingestFederalLedger(csv, { source: 'api' });
  assert.equal(imported.count, 1);
  const minimal = store.listCasesMinimal();
  assert.equal(minimal.length, 1);
  const caseId = minimal[0].caseId;
  const detail = store.getCase(caseId);
  assert.ok(detail.timeline.some((t) => t.stage === 'accepted'));
  assert.ok(detail.ledger?.ackCode === 'A' || detail.timeline.some((t) => t.stage === 'funded'));
});

test('gateway comms tunnel stays stub-blocked without credentials', () => {
  const adapter = createGatewayCommsTunnelAdapter({ enabled: false });
  assert.equal(adapter.status, 'stub');
  const gate = evaluateGatewayCommsProtection({
    enabled: false,
    topsEndpoint: 'unset',
    fiscalEndpoint: 'unset',
    clientId: 'unset',
    clientSecret: 'unset',
    approvedTunnelEndpoint: 'unset',
    appEnv: 'local'
  });
  assert.equal(gate.allowed, false);
  const probe = probeGatewayCommsTunnel({ enabled: false });
  assert.equal(probe.status, 'stub');
  const session = openGatewayCommsSession({ channel: 'TOPS', caseId: 'CASE-1' }, { enabled: false });
  assert.equal(session.status, 'denied');
  assert.ok(describeFederalRefundTraceModule().name.includes('federal-refund-trace'));
});

test('/rtpsc auth, ingest, run-full-path, cases APIs', async () => {
  const registry = createClientRegistry({ env: {}, persist: false });
  const issued = await registry.ensureLocalClients();
  assert.ok(issued.length >= 1);
  const apiClient = issued.find((i) => i.credentials.kind === 'api') ?? issued[0];
  const store = createRefundStore();
  const { server } = createRefundStatusServer({ registry, store });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const headers = {
    'content-type': 'application/json',
    'x-api-client-id': apiClient.credentials.clientId,
    'x-api-client-secret': apiClient.credentials.clientSecret
  };

  try {
    const authRes = await fetch(`${base}/rtpsc/auth`, { method: 'POST', headers, body: '{}' });
    assert.equal(authRes.status, 200);
    const auth = await authRes.json();
    assert.ok(auth.session_token);

    const ingestRes = await fetch(`${base}/rtpsc/cases/ingest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        caseId: 'CASE-RTPSC-1',
        taxpayerRef: 'TP-9999',
        amount: 1200,
        filingStage: 'sent'
      })
    });
    assert.equal(ingestRes.status, 201);

    const csv = await readFile(fixturePath, 'utf8');
    const fullRes = await fetch(`${base}/rtpsc/cases/CASE-RTPSC-1/run-full-path`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ledgerText: csv, taxpayerRef: 'TP-1234', channel: 'TOPS' })
    });
    assert.equal(fullRes.status, 200);
    const full = await fullRes.json();
    assert.ok(full.timeline.length >= 1);
    assert.equal(full.tunnelSession.channel, 'TOPS');
    assert.ok(['denied', 'session_ready_stub'].includes(full.tunnelSession.status));

    const listRes = await fetch(`${base}/rtpsc/cases`);
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.ok(list.some((c) => c.caseId === 'CASE-RTPSC-1'));

    const getRes = await fetch(`${base}/rtpsc/cases/CASE-RTPSC-1`);
    assert.equal(getRes.status, 200);
    const got = await getRes.json();
    assert.ok(got.case);
    assert.ok(Array.isArray(got.timeline));

    const tunnelRes = await fetch(`${base}/rtpsc/tunnel`);
    assert.equal(tunnelRes.status, 200);
    const tunnel = await tunnelRes.json();
    assert.equal(tunnel.probe.status, 'stub');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
