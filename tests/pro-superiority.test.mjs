import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTaxPrepStore,
  diagnoseReturn,
  describeTaxPrep,
  listForms,
  listInterviewModules
} from '../packages/tax-prep/src/index.mjs';
import {
  buildSuperiorityScorecard,
  describeProSuperiority,
  listDifferentiators
} from '../packages/pro-superiority/src/index.mjs';

test('tax-prep catalogs forms and interview modules', () => {
  assert.ok(listForms().some((f) => f.id === '1040'));
  assert.ok(listInterviewModules().some((m) => m.id === 'credits'));
  assert.equal(describeTaxPrep().name, '@rtp/tax-prep');
});

test('diagnoseReturn flags EITC without Form 8867', () => {
  const d = diagnoseReturn({
    displayName: 'Jordan Ellis',
    taxpayerRef: 'TP-1',
    wages: 30000,
    withholding: 2000,
    claimEitc: true,
    documents: ['w2']
  });
  assert.equal(d.ok, false);
  assert.ok(d.findings.some((f) => f.code === 'DD-001'));
});

test('tax-prep store creates return and reaches ready_to_efile when clean', () => {
  const store = createTaxPrepStore();
  const created = store.createReturn({
    displayName: 'Alex Rivera',
    taxpayerRef: 'TP-2',
    wages: 55000,
    withholding: 6200,
    documents: ['1040', 'w2', '8867']
  });
  store.updateInterview(created.id, {
    displayName: 'Alex Rivera',
    taxpayerRef: 'TP-2',
    wages: 55000,
    withholding: 6200,
    documents: ['1040', 'w2', '8867']
  });
  const result = store.runDiagnostics(created.id);
  assert.equal(result.diagnostics.ok, true);
  assert.equal(result.return.stage, 'ready_to_efile');
  assert.ok(result.diagnostics.refundMath);
});

test('pro superiority scorecard beats Pro-class on key ops rows', () => {
  const card = buildSuperiorityScorecard();
  assert.ok(card.index >= 70);
  assert.equal(card.verdict, 'superior_scaffold');
  assert.ok(card.rows.some((r) => r.id === 'refund-intelligence' && r.posture === 'ahead'));
  assert.ok(card.rows.some((r) => r.id === 'live-mef-calc' && r.posture === 'building'));
  assert.ok(listDifferentiators().length >= 7);
  assert.match(describeProSuperiority().competitor, /TaxSlayer Pro/);
});
