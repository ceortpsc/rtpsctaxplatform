import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResolutionPlan, laneCatalog } from '../src/index.mjs';

test('routes unauthorized return to critical identity lane', () => {
  const plan = buildResolutionPlan({
    taxYear: 2023,
    taxpayerDeniedFiling: true,
    unauthorizedReturn: true,
    amendedReturns: 3,
    highRiskCredit: true,
    flags: ['UNSUPPORTED_CREDIT'],
    returnData: { wages: 0, businessIncome: 7800, refundableCredits: 3623, refund: 2521 },
    wageIncome: { wages: 145, cancellationOfDebt: 1698 },
    account: { transactionCodes: [150, 570, 810, 971, 977, 420] }
  });
  assert.equal(plan.primaryLane, 'IDENTITY_THEFT_OR_UNAUTHORIZED_RETURN');
  assert.equal(plan.status, 'HOLD_FOR_EVIDENCE_AND_IRS_DETERMINATION');
  assert.ok(plan.secondaryLanes.includes('AMENDED_RETURN_PROCESSING'));
  assert.ok(plan.secondaryLanes.includes('EXAMINATION_CONTROL'));
});

test('routes CP05B withholding mismatch to RIVO lane', () => {
  const plan = buildResolutionPlan({
    taxYear: 2025,
    noticeCode: 'CP05B',
    returnData: { withholding: 11485 },
    wageIncome: { withholding: 8450 },
    account: { transactionCodes: [570] }
  });
  assert.equal(plan.primaryLane, 'WITHHOLDING_VERIFICATION');
  assert.equal(plan.case.mismatches.withholding, 3035);
});

test('detects refund reversal and prevents false availability', () => {
  const plan = buildResolutionPlan({ taxYear: 2024, account: { transactionCodes: [846, 841, 290] } });
  assert.equal(plan.primaryLane, 'ERRONEOUS_REFUND_OR_REVERSAL');
  assert.ok(plan.prohibitedActions.some((x) => x.includes('refund approval')));
});

test('catalog exposes nine resolution lanes', () => {
  assert.equal(laneCatalog().length, 9);
});
