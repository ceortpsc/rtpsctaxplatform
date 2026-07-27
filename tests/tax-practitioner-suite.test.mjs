import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeTransactionCodes,
  evaluateRefundReleaseGate,
  rectifyTransactionCode,
  TC_CATALOG
} from '../engines/tc-code-engine/src/index.mjs';
import { processMasterfileRecord } from '../pipelines/masterfile-pipeline/src/index.mjs';
import { createRefundReleaseStore } from '../packages/refund-release-core/src/index.mjs';
import {
  buildPractitionerAccountXml,
  buildRefundReleaseRequestXml,
  isWellFormedXml
} from '../packages/irs-xml/src/index.mjs';
import { createPractitionerSuite } from '../packages/irs-practitioner/src/index.mjs';
import { createPlatformRegistry, sampleInputs } from '../workers/workflow-runner/src/registry.mjs';

test('TC catalog includes 570 and 810 hold codes', () => {
  assert.ok(TC_CATALOG.some((c) => c.code === '570' && c.hold));
  assert.ok(TC_CATALOG.some((c) => c.code === '810' && c.creditElect));
});

test('rectify 570/810 clears release gate', () => {
  let codes = [
    { code: '150', status: 'posted' },
    { code: '570', status: 'open' },
    { code: '810', status: 'open' }
  ];
  assert.equal(analyzeTransactionCodes(codes).blocking, true);
  const r570 = rectifyTransactionCode({ caseId: 'UF-1', code: '570', codes });
  codes = r570.analysis.codes;
  const r810 = rectifyTransactionCode({ caseId: 'UF-1', code: '810', codes });
  const gate = evaluateRefundReleaseGate({ codes: r810.analysis.codes, masterfileRectified: true });
  assert.equal(gate.eligible, true);
  assert.equal(r810.event.type, 'masterfile.tc.rectified');
});

test('masterfile pipeline rectifies holds and evaluates gate', () => {
  const result = processMasterfileRecord({
    caseId: 'UF-2026-001',
    taxpayerRef: 'TP-UF-001',
    rectifyCodes: ['570', '810']
  });
  assert.equal(result.pipeline, 'masterfile-pipeline');
  assert.equal(result.gate.eligible, true);
  assert.equal(result.liveIrsMasterfileAdjustmentsApplied, false);
});

test('refund release request → approve → issue → reconcile', () => {
  const store = createRefundReleaseStore({
    protection: () => ({ transmissionAllowed: false })
  });
  const mf = processMasterfileRecord({
    caseId: 'UF-9',
    taxpayerRef: 'TP-9',
    rectifyCodes: ['570', '810']
  });
  const req = store.requestRelease({
    caseId: 'UF-9',
    taxpayerRef: 'TP-9',
    amount: 1500,
    transactionCodes: mf.analysis.codes,
    masterfileRectified: true
  });
  assert.ok(isWellFormedXml(req.xml));
  const approved = store.approveRelease(req.id);
  assert.equal(approved.status, 'approved-held');
  const issued = store.issueRefund(approved.id);
  assert.equal(issued.issued, true);
  assert.equal(issued.liveIrsIssuance, false);
  assert.equal(issued.tc846Posted, true);
  const rcn = store.reconcile({ releaseRequestId: issued.id, amount: 1500 });
  assert.equal(rcn.balanced, true);
  assert.ok(isWellFormedXml(rcn.xml));
});

test('practitioner XML account is well-formed', () => {
  const xml = buildPractitionerAccountXml({
    name: 'R Condre Dvon Ross',
    cafRedacted: '031***228',
    ptinRedacted: 'P032***',
    state: 'TX',
    apiClientConfigured: true,
    tdsClientConfigured: true,
    irsOAuthConfigured: false
  });
  assert.ok(isWellFormedXml(xml));
  assert.ok(isWellFormedXml(buildRefundReleaseRequestXml({ requestId: 'rel_1', caseId: 'C1', amount: 1 })));
});

test('practitioner suite executes full lifecycle', async () => {
  const suite = createPractitionerSuite({
    env: {
      OPERATOR_NAME: 'R Condre Dvon Ross',
      OPERATOR_EMAIL: 'ceo@rosstaxsoftware.com',
      FIRM_STATE: 'TX',
      ERO_PTIN: 'P032155',
      ERO_CAF_NUMBER: '031676228'
    },
    releaseStore: createRefundReleaseStore({ protection: () => ({ transmissionAllowed: false }) })
  });
  const result = suite.executeRefundReleaseLifecycle({
    caseId: 'UF-2026-003',
    taxpayerRef: 'TP-UF-003',
    amount: 2100
  });
  assert.equal(result.release.issued, true);
  assert.equal(result.reconciliation.balanced, true);
  assert.ok(result.masterfile.gate.eligible);
  assert.ok(result.assist.ok || result.assist.blocked === false);
});

test('refund release workflow runs via platform registry', async () => {
  const { runner } = createPlatformRegistry();
  const run = await runner.run('refund-release-after-tc-rectify', sampleInputs['refund-release-after-tc-rectify']);
  assert.equal(run.status, 'succeeded');
  assert.equal(run.output.emittedEvent.type, 'refund.release.completed');
  assert.equal(run.output.release.issued, true);
});
