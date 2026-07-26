import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPersonaActionAllowed,
  governanceBanner,
  listCatalog,
  createHireRequest,
  scopeTask,
  priceTask,
  payTask,
  queueTask,
  runPersonaStep,
  humanApprove,
  placeHold,
  __resetStoreForTests
} from '../packages/ero-governance/src/index.mjs';
import { hireAndRunLiveService } from '../engines/ai-persona-runtime/src/index.mjs';
import { aiWorkforceHubDescriptor } from '../services/ai-workforce-hub/src/index.mjs';

test('governance banner discloses private-company IRM-style controls', () => {
  const banner = governanceBanner();
  assert.match(banner.notice, /NOT AN IRS PUBLICATION/);
  assert.ok(banner.hardProhibitions.includes('transmit_a_return'));
  assert.ok(banner.crmRules.includes('RTP-CRM-101'));
});

test('persona cannot transmit a return', () => {
  const gate = assertPersonaActionAllowed('efile-status-agent', 'transmit_a_return');
  assert.equal(gate.ok, false);
  assert.equal(gate.code, 'governance_blocked');
});

test('catalog contains practitioner-for-hire SKUs', () => {
  const catalog = listCatalog();
  assert.ok(catalog.some((item) => item.code === 'TAX-102'));
  assert.ok(catalog.some((item) => item.code === 'SFT-709'));
});

test('hire → pay → run → human approve happy path', () => {
  __resetStoreForTests();
  const hire = createHireRequest({
    serviceCode: 'TAX-101',
    personaId: 'concierge',
    clientReference: 'c-demo',
    authenticated: true
  });
  assert.equal(hire.ok, true);
  const id = hire.task.id;
  assert.equal(scopeTask(id, 'Strategy consult').ok, true);
  assert.equal(priceTask(id).ok, true);
  const paid = payTask(id, { reference: 'pay-demo' });
  assert.equal(paid.ok, true);
  assert.equal(paid.payment.status, 'captured_stub');
  assert.equal(queueTask(id).ok, true);
  const ran = runPersonaStep(id, {});
  assert.equal(ran.ok, true);
  assert.ok(['HUMAN_REVIEW', 'IN_PROGRESS', 'DELIVERED'].includes(ran.task.state));
  if (ran.task.state === 'HUMAN_REVIEW') {
    const approved = humanApprove(id, { reviewer: 'ero-manager' });
    assert.equal(approved.ok, true);
    assert.equal(approved.task.state, 'DELIVERED');
  }
});

test('AI cannot clear HOLD', () => {
  __resetStoreForTests();
  const hire = createHireRequest({
    serviceCode: 'TAX-111',
    personaId: 'efile-status-agent',
    authenticated: true
  });
  const id = hire.task.id;
  scopeTask(id, 'transcript review');
  priceTask(id);
  payTask(id);
  queueTask(id);
  placeHold(id, 'Identity inconsistency');
  const ran = runPersonaStep(id, {});
  assert.equal(ran.ok, false);
  assert.equal(ran.code, 'hold_locked');
  const spoofed = humanApprove(id, { reviewer: 'office-manager-bot' });
  assert.equal(spoofed.ok, false);
  assert.equal(spoofed.code, 'unauthorized_reviewer');
  const cleared = humanApprove(id, { reviewer: 'human-reviewer' });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.task.state, 'DELIVERED');
});

test('live service orchestrator completes under governance', () => {
  __resetStoreForTests();
  const result = hireAndRunLiveService({
    serviceCode: 'DOC-901',
    personaId: 'document-analyst',
    clientReference: 'c-letter',
    autoHumanApprove: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.task.state, 'DELIVERED');
  assert.equal(aiWorkforceHubDescriptor.domain, 'ai-workforce');
});
