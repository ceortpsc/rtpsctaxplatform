import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRefund,
  runOptimizationWorkflow,
  scanRefundableCredits
} from '../engines/refund-optimization-engine/src/index.mjs';
import {
  buildRefundIntelligence,
  resolveCanonicalStatus,
  detectGuardLevel,
  REFUND_STATES
} from '../engines/refund-intelligence-engine/src/index.mjs';

test('refund formula is withholding + refundables − liability', () => {
  const result = computeRefund({
    withholding: 5000,
    refundableCredits: 2000,
    nonRefundableCredits: 500,
    taxLiability: 3000
  });
  // liability after nonrefundable = 2500; refund = 5000 + 2000 - 2500 = 4500
  assert.equal(result.refund, 4500);
  assert.equal(result.isRefund, true);
});

test('ROI workflow prioritizes refundables and HOH evaluation', () => {
  const roi = runOptimizationWorkflow({
    withholding: 8000,
    taxLiability: 3500,
    earnedIncome: 30000,
    qualifyingChildren: 2,
    possibleHoh: true,
    educationExpenses: true,
    selfEmployed: true,
    netProfit: 40000
  });
  assert.ok(roi.creditScan.some((credit) => credit.id === 'EITC' && credit.eligible));
  assert.equal(roi.filing.recommended.status, 'HOH');
  assert.ok(roi.recommendations.some((line) => /refundable credits first/i.test(line)));
  assert.ok(roi.explanation.narrative.includes('Baseline computed refund'));
  assert.ok(roi.seSimulation);
});

test('refund intelligence resolves lifecycle + guard + ETA', () => {
  assert.ok(REFUND_STATES.includes('DISBURSED'));
  const canonical = resolveCanonicalStatus({ wmrStatus: 'Approved', rfifStatus: 'IN_PROCESS' });
  assert.equal(canonical.state, 'APPROVED');
  const guard = detectGuardLevel({ identityFlag: true, repeatedRejects: 2 });
  assert.equal(guard.level, 'HIGH');
  const intel = buildRefundIntelligence({
    signals: { wmrStatus: 'IN_PROCESS', manualReview: true },
    roi: { withholding: 1000, taxLiability: 800, earnedIncome: 12000, qualifyingChildren: 1 }
  });
  assert.equal(intel.guardLevel.level, 'HIGH');
  assert.ok(intel.exceptionRoutes.includes('require-human-review'));
  assert.ok(intel.refundEta.maxDays >= intel.refundEta.minDays);
});

test('unsupported patterns raise audit flags', () => {
  const roi = runOptimizationWorkflow({
    fakeDependentSuspected: true,
    seIncomeOnlyForEitc: true,
    earnedIncome: 1,
    qualifyingChildren: 1
  });
  assert.ok(roi.risks.some((flag) => flag.code === 'FAKE_DEPENDENT' && flag.level === 'HIGH'));
});

test('credit scan disables EITC without earned income', () => {
  const scan = scanRefundableCredits({ earnedIncome: 0, qualifyingChildren: 2 });
  assert.equal(scan.find((credit) => credit.id === 'EITC').eligible, false);
});

test('HOH boost never deepens an amount owed', () => {
  const roi = runOptimizationWorkflow({
    withholding: 100,
    taxLiability: 5000,
    possibleHoh: true,
    qualifyingChildren: 1,
    earnedIncome: 20000
  });
  assert.equal(roi.filing.recommended.status, 'HOH');
  assert.ok(roi.optimized.owed >= 0);
  assert.equal(roi.optimized.isRefund, roi.optimized.refund >= 0);
  assert.equal(roi.optimized.owed, roi.optimized.refund < 0 ? Math.abs(roi.optimized.refund) : 0);
  // When baseline is owed, optimized owed must not exceed a worsened baseline from a negative boost.
  assert.ok(roi.optimized.refund >= roi.baseline.refund || roi.optimized.isRefund);
});
