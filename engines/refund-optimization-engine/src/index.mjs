import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';

/**
 * Refund Optimization Intelligence (ROI)
 * Core identity:
 *   Refund = Withholding + Refundable Credits − Tax Liability
 */

export const refundOptimizationEngine = createEngineDescriptor({
  name: 'refund-optimization-engine',
  capabilities: [
    'refundable-credit-scan',
    'taxable-income-reduction',
    'withholding-strategy',
    'filing-status-optimization',
    'dependent-validation',
    'se-vs-scorp-simulation',
    'timing-strategies',
    'audit-risk-flagging',
    'deterministic-scenario-compare',
    'audit-grade-explanation'
  ],
  outputs: [
    'refund-canonical',
    'optimization-scenarios',
    'refund-boost-recommendations',
    'guard-risk-flags',
    'explanation-block'
  ]
});

export const REFUNDABLE_CREDITS = Object.freeze([
  { id: 'EITC', name: 'Earned Income Tax Credit', maxApprox: 7000, requiresEarnedIncome: true },
  { id: 'ACTC', name: 'Additional Child Tax Credit (refundable CTC)', maxApprox: 1600, requiresEarnedIncome: true },
  { id: 'AOTC', name: 'American Opportunity Credit (refundable portion)', maxApprox: 1000, requiresEarnedIncome: false },
  { id: 'PTC', name: 'Premium Tax Credit', maxApprox: null, requiresEarnedIncome: false },
  { id: 'FUEL', name: 'Fuel tax credit', maxApprox: null, requiresEarnedIncome: false },
  { id: 'SFL', name: 'Sick/Family leave credit (self-employed)', maxApprox: null, requiresEarnedIncome: true }
]);

export const FILING_STATUSES = Object.freeze(['Single', 'MFJ', 'MFS', 'HOH', 'QW']);

export function computeRefund({
  withholding = 0,
  refundableCredits = 0,
  nonRefundableCredits = 0,
  taxLiability = 0
} = {}) {
  const liabilityAfterNonRefundable = Math.max(0, Number(taxLiability) - Number(nonRefundableCredits));
  const refund = Number(withholding) + Number(refundableCredits) - liabilityAfterNonRefundable;
  return {
    formula: 'Refund = Withholding + Refundable Credits − max(0, Tax Liability − Nonrefundable Credits)',
    withholding: Number(withholding),
    refundableCredits: Number(refundableCredits),
    nonRefundableCredits: Number(nonRefundableCredits),
    taxLiability: Number(taxLiability),
    liabilityAfterNonRefundable,
    refund,
    owed: refund < 0 ? Math.abs(refund) : 0,
    isRefund: refund >= 0
  };
}

export function scanRefundableCredits(input = {}) {
  const earnedIncome = Number(input.earnedIncome || 0);
  const dependents = Number(input.qualifyingChildren || 0);
  const education = Boolean(input.educationExpenses);
  const marketplace = Boolean(input.marketplacePremiums);
  const selfEmployed = Boolean(input.selfEmployed);

  return REFUNDABLE_CREDITS.map((credit) => {
    let eligible = true;
    let note = 'Evaluate with full worksheet';
    if (credit.requiresEarnedIncome && earnedIncome <= 0) {
      eligible = false;
      note = 'Requires earned income';
    }
    if (credit.id === 'EITC' || credit.id === 'ACTC') {
      if (dependents <= 0 && credit.id === 'ACTC') {
        eligible = false;
        note = 'Requires qualifying child';
      }
    }
    if (credit.id === 'AOTC' && !education) {
      eligible = false;
      note = 'No education expenses flagged';
    }
    if (credit.id === 'PTC' && !marketplace) {
      eligible = false;
      note = 'No marketplace premiums flagged';
    }
    if (credit.id === 'SFL' && !selfEmployed) {
      eligible = false;
      note = 'Self-employed only';
    }
    return { ...credit, eligible, note };
  });
}

export function compareStandardVsItemized(input = {}) {
  const standard = Number(input.standardDeduction || 14600);
  const itemized = Number(input.itemizedTotal || 0);
  const chosen = itemized > standard ? 'itemized' : 'standard';
  return {
    standardDeduction: standard,
    itemizedTotal: itemized,
    chosen,
    delta: Math.abs(itemized - standard),
    recommendation: chosen === 'itemized'
      ? 'Itemize — exceeds standard deduction'
      : 'Take standard deduction — itemized does not exceed'
  };
}

export function evaluateFilingStatus(input = {}) {
  const statuses = FILING_STATUSES.map((status) => {
    let score = 0;
    let note = '';
    if (status === 'HOH' && input.possibleHoh) {
      score = 95;
      note = 'Highest common value lever if residency/support tests met';
    } else if (status === 'MFJ' && input.married) {
      score = 90;
      note = 'Often optimal for dual-income / credit phaseouts';
    } else if (status === 'Single' && !input.married) {
      score = 70;
      note = 'Baseline unmarried status';
    } else if (status === 'MFS' && input.married) {
      score = 40;
      note = 'Usually suboptimal for credits; evaluate carefully';
    } else if (status === 'QW' && input.qualifyingWidow) {
      score = 88;
      note = 'MFJ-equivalent benefits when eligible';
    } else {
      score = 10;
      note = 'Likely ineligible';
    }
    return { status, score, note };
  }).sort((a, b) => b.score - a.score);

  return {
    recommended: statuses[0],
    alternatives: statuses.slice(1),
    rule: 'Auto-evaluate HOH eligibility — most valuable common filing status lever'
  };
}

export function detectAuditRiskFlags(input = {}) {
  const flags = [];
  if (input.fakeDependentSuspected) flags.push({ code: 'FAKE_DEPENDENT', level: 'HIGH', message: 'Dependent pattern inconsistent with residency/support evidence' });
  if (input.seIncomeOnlyForEitc) flags.push({ code: 'SE_FOR_EITC', level: 'HIGH', message: 'Self-employment income appears structured only to unlock EITC' });
  if (input.educationExpenseUnsupported) flags.push({ code: 'FAKE_EDUCATION', level: 'HIGH', message: 'Education credit without substantiating 1098-T / payments' });
  if (input.childcareUnsupported) flags.push({ code: 'FAKE_CHILDCARE', level: 'HIGH', message: 'Childcare credit without provider TIN / substantiation' });
  if (input.mileageUnsupported) flags.push({ code: 'FAKE_MILEAGE', level: 'MEDIUM', message: 'Mileage claim lacks contemporaneous log' });
  if (input.charityUnsupported) flags.push({ code: 'FAKE_CHARITY', level: 'MEDIUM', message: 'Charitable contribution lacks acknowledgment' });
  if (input.repeatedRejects >= 2) flags.push({ code: 'REPEATED_REJECTS', level: 'MEDIUM', message: 'Repeated rejects with same error pattern' });
  return flags;
}

export function simulateSeVsScorp(input = {}) {
  const netProfit = Number(input.netProfit || 0);
  const seTax = netProfit * 0.153 * 0.9235;
  const reasonableWage = Number(input.reasonableWage || Math.min(netProfit * 0.4, netProfit));
  const scorpSeProxy = Math.max(0, reasonableWage) * 0.153;
  return {
    soleProp: { netProfit, estimatedSeTax: Number(seTax.toFixed(2)) },
    sCorp: {
      reasonableWage,
      estimatedPayrollTax: Number(scorpSeProxy.toFixed(2)),
      remainingDistribution: Number((netProfit - reasonableWage).toFixed(2))
    },
    deltaSeTax: Number((seTax - scorpSeProxy).toFixed(2)),
    note: 'Scaffold simulation only — not tax advice; confirm reasonable compensation and entity formalities.'
  };
}

export function runOptimizationWorkflow(input = {}) {
  const creditScan = scanRefundableCredits(input);
  const eligibleRefundables = creditScan.filter((credit) => credit.eligible);
  const estimatedRefundable = Number(
    input.refundableCredits ??
      eligibleRefundables.reduce((sum, credit) => sum + (credit.maxApprox || 0) * 0.35, 0)
  );
  const deductionCompare = compareStandardVsItemized(input);
  const filing = evaluateFilingStatus(input);
  const risks = detectAuditRiskFlags(input);
  const seSim = input.selfEmployed ? simulateSeVsScorp(input) : null;

  const baseline = computeRefund({
    withholding: input.withholding ?? 0,
    refundableCredits: estimatedRefundable,
    nonRefundableCredits: input.nonRefundableCredits ?? 0,
    taxLiability: input.taxLiability ?? 0
  });

  // HOH boost only applies when the baseline is already a refund (never deepen an amount owed).
  const hohBoost =
    filing.recommended.status === 'HOH' && baseline.refund > 0
      ? Math.round(baseline.refund * 0.04)
      : 0;
  const optimizedLiability = Math.max(
    0,
    baseline.taxLiability - (deductionCompare.chosen === 'itemized' ? deductionCompare.delta * 0.12 : 0)
  );
  const optimized = computeRefund({
    withholding: baseline.withholding,
    refundableCredits: baseline.refundableCredits + hohBoost,
    nonRefundableCredits: baseline.nonRefundableCredits ?? 0,
    taxLiability: optimizedLiability
  });
  const recommendations = [];
  recommendations.push('Check refundable credits first — they move refund magnitude most.');
  if (eligibleRefundables.some((credit) => credit.id === 'EITC')) {
    recommendations.push('Complete EITC eligibility worksheet; most commonly missed refundable credit.');
  }
  if (input.possibleHoh) {
    recommendations.push('Confirm Head of Household tests — high-value filing status lever.');
  }
  recommendations.push(deductionCompare.recommendation);
  if (input.selfEmployed) {
    recommendations.push('Auto-calculate SE deductions; compare mileage vs actual and home-office methods.');
    recommendations.push('Simulate SE vs S-Corp payroll tax impact before entity changes.');
  }
  if ((input.withholding ?? 0) < (input.taxLiability ?? 0) * 0.8) {
    recommendations.push('Under-withholding detected — consider W-4 / estimated payment strategy (does not reduce tax).');
  }
  if (risks.some((flag) => flag.level === 'HIGH')) {
    recommendations.push('HIGH audit-risk flags present — require human review before filing.');
  }

  const explanation = buildExplanationBlock({
    baseline,
    optimized,
    filing,
    deductionCompare,
    eligibleRefundables,
    risks,
    recommendations
  });

  return {
    engine: refundOptimizationEngine.name,
    workflow: [
      'identify-filing-status',
      'validate-dependents',
      'calculate-refundable-credits',
      'calculate-nonrefundable-credits',
      'calculate-adjustments',
      'calculate-taxable-income',
      'calculate-tax-liability',
      'calculate-withholding',
      'compute-refund',
      'run-optimization-scenarios',
      'generate-recommendations',
      'generate-audit-grade-explanation'
    ],
    creditScan,
    deductionCompare,
    filing,
    seSimulation: seSim,
    risks,
    baseline,
    optimized: {
      ...optimized,
      scenarios: [
        { id: 'filing-status', choice: filing.recommended.status },
        { id: 'deduction-method', choice: deductionCompare.chosen },
        { id: 'se-vs-scorp', choice: seSim ? 'simulated' : 'n/a' }
      ]
    },
    recommendations,
    explanation,
    compliance: refundOptimizationEngine.compliance
  };
}

export function buildExplanationBlock({
  baseline,
  optimized,
  filing,
  deductionCompare,
  eligibleRefundables,
  risks,
  recommendations
}) {
  const riskLine =
    risks.length === 0
      ? 'No high-pattern audit flags detected in scaffold rules.'
      : `Risk flags: ${risks.map((flag) => flag.code).join(', ')}.`;

  return {
    title: 'Refund Optimization Intelligence — Audit-Grade Explanation',
    brand: 'RTPSC / 254 TAX CONSULTANTS / PrimeWeb',
    narrative: [
      `Baseline computed refund is ${baseline.refund.toFixed(2)} using withholding ${baseline.withholding.toFixed(2)}, refundable credits ${baseline.refundableCredits.toFixed(2)}, and liability ${baseline.taxLiability.toFixed(2)}.`,
      `Recommended filing posture leans ${filing.recommended.status} (${filing.recommended.note}).`,
      `Deduction method: ${deductionCompare.chosen}.`,
      `Eligible refundable credit families: ${eligibleRefundables.map((credit) => credit.id).join(', ') || 'none flagged'}.`,
      riskLine,
      `Optimized scaffold estimate: ${optimized.refund.toFixed(2)}.`,
      'This module provides compliance-safe scenario intelligence — not a substitute for signed preparer judgment.'
    ].join(' '),
    recommendations,
    immutable: true,
    timestamp: new Date().toISOString()
  };
}
