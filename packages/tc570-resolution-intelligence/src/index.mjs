import { createHash, randomUUID } from 'node:crypto';

export const ENGINE = Object.freeze({
  name: 'ROSS.CO TC 570 Resolution Intelligence',
  version: '1.0.0',
  boundary: 'Evidence-driven reconciliation only; no IRS account-write or transaction-code removal capability.'
});

const codes = Object.freeze({
  HOLD: 570,
  HOLD_RELEASED: 571,
  REFUND_FREEZE: 810,
  FREEZE_RELEASED: 811,
  REFUND_ISSUED: 846,
  REFUND_CANCELLED: 841,
  ERRONEOUS_REFUND: 844,
  ERRONEOUS_REFUND_REVERSED: 845,
  EXAM: 420,
  EXAM_PENDING: 424,
  AMENDED_FORWARDED: 971,
  AMENDED_FILED: 977,
  ADDITIONAL_TAX: 290,
  ABATEMENT: 291,
  OFFSET: 826,
  TOP_OFFSET: 898,
  TOP_REVERSAL: 899
});

const lanes = Object.freeze([
  {
    id: 'IDENTITY_THEFT_OR_UNAUTHORIZED_RETURN',
    severity: 'CRITICAL',
    owner: 'Identity Protection / notice-assigned function',
    match: (c) => c.taxpayerDeniedFiling || c.unauthorizedReturn,
    evidence: ['Signed taxpayer denial and authorization affidavit', 'Questioned return and IRS notice', 'Form 14039 when directed', 'Forms 14157/14157-A when preparer misconduct applies', 'Correct-return reconstruction', 'Form 8879 and e-file origin records if obtainable'],
    actions: ['Preserve every notice deadline', 'Do not adopt disputed return entries as taxpayer facts', 'Route identity theft and preparer misconduct in the alternative when facts support both', 'Request written IRS control ownership']
  },
  {
    id: 'WITHHOLDING_VERIFICATION',
    severity: 'HIGH',
    owner: 'RIVO / Withholding Only Work',
    match: (c) => ['CP05A', 'CP05B'].includes(c.noticeCode) || c.mismatches.withholding > 0,
    evidence: ['Payer-issued income documents', 'Corrected information returns', 'Forms 941/945 and EFTPS records where relevant', 'Bank/payment proof', 'Return-to-Wage-and-Income reconciliation'],
    actions: ['Identify each unverified payer and amount', 'Submit notice-specific proof by the printed deadline', 'Claim withholding only with the related income', 'Monitor written allowance or disallowance']
  },
  {
    id: 'AMENDED_RETURN_PROCESSING',
    severity: 'HIGH',
    owner: 'Accounts Management / controlling exam function',
    match: (c) => c.amendedReturns > 0 || c.transactionCodes.some((x) => [codes.AMENDED_FORWARDED, codes.AMENDED_FILED].includes(x)),
    evidence: ['Every Form 1040-X and attachment', 'E-file or delivery proof', 'Line-by-line supersession reconciliation', 'Current transcripts'],
    actions: ['Map each TC 971/977 to a filing', 'Identify the controlling amended return', 'Prevent duplicate credits and contradictory claims', 'Coordinate with Examination before adjustment requests']
  },
  {
    id: 'EXAMINATION_CONTROL',
    severity: 'CRITICAL',
    owner: 'Examination / AIMS-controlled group',
    match: (c) => c.transactionCodes.some((x) => [codes.EXAM, codes.EXAM_PENDING].includes(x)),
    evidence: ['Examination notices and IDRs', 'Issue-by-issue substantiation', 'Legal memorandum', 'Appeal and court deadline calendar'],
    actions: ['Route to the assigned examiner', 'Preserve appeal and Tax Court rights', 'Do not seek mechanical freeze release while Exam controls the module', 'Request a written determination']
  },
  {
    id: 'ERRONEOUS_REFUND_OR_REVERSAL',
    severity: 'CRITICAL',
    owner: 'Accounts Management / Accounting Erroneous Refund function',
    match: (c) => c.refundReversalDetected || c.transactionCodes.some((x) => [codes.REFUND_CANCELLED, codes.ERRONEOUS_REFUND, codes.ERRONEOUS_REFUND_REVERSED].includes(x)),
    evidence: ['Complete TC 840/841/844/845/846 timeline', 'Treasury or ACH trace', 'Bank receipt/return evidence', 'Replacement-refund records', 'Offset history'],
    actions: ['Classify cancellation, duplicate, misdirected, replacement or erroneous-credit issue', 'Do not treat reversed TC 846 as available', 'Request transaction-specific accounting explanation', 'Reconcile related interest and penalties']
  },
  {
    id: 'OFFSET_OR_CREDIT_TRANSFER',
    severity: 'MEDIUM',
    owner: 'Accounts Management / Treasury Offset Program as applicable',
    match: (c) => c.transactionCodes.some((x) => [codes.OFFSET, codes.TOP_OFFSET, codes.TOP_REVERSAL].includes(x)),
    evidence: ['Source and destination transcripts', 'TOP notice and agency debt detail', 'Payment/credit-transfer records', 'Form 8379 facts when applicable'],
    actions: ['Identify debt, agency, tax period and amount', 'Separate IRS and TOP offsets', 'Route offset-dispute or injured-spouse relief', 'Recompute remaining overpayment']
  },
  {
    id: 'MATH_ERROR_OR_ACCOUNT_ADJUSTMENT',
    severity: 'HIGH',
    owner: 'Accounts Management / notice-assigned function',
    match: (c) => ['CP11', 'CP12', 'CP13'].includes(c.noticeCode) || c.transactionCodes.some((x) => [codes.ADDITIONAL_TAX, codes.ABATEMENT].includes(x)),
    evidence: ['Notice-to-return line comparison', 'Correct source records and computation', 'Proof of timely disagreement', 'Post-adjustment transcript'],
    actions: ['Classify math error, assessment, abatement or account correction', 'Respond within time-limited notice rights', 'Request reversal only with evidence', 'Track downstream penalty and interest corrections']
  },
  {
    id: 'UNSUPPORTED_OR_HIGH_RISK_CREDIT',
    severity: 'CRITICAL',
    owner: 'RIVO / Frivolous Return Program / Examination as assigned',
    match: (c) => c.highRiskCredit || c.flags.includes('UNSUPPORTED_CREDIT'),
    evidence: ['Form-specific eligibility worksheet', 'Source receipts/logs', 'Corrected computation', 'Factual basis for original claim'],
    actions: ['Substantiate statutory elements or prepare a corrective return', 'Never relabel or manufacture a credit', 'Address IRC 6676/6702 exposure', 'Request only the legally verified overpayment']
  },
  {
    id: 'GENERAL_PROCESSING_HOLD',
    severity: 'MEDIUM',
    owner: 'Accounts Management / function shown by notice and control',
    match: () => true,
    evidence: ['Current return, account and Wage & Income transcripts', 'All notices and prior responses', 'Return/source reconciliation', 'Submission receipts'],
    actions: ['Identify the controlling IRS function', 'Use the notice-specific response channel', 'Request the exact unresolved item', 'Monitor authoritative TC and notice changes']
  }
]);

function amount(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function normalizeCase(input = {}) {
  const returnData = input.returnData ?? {};
  const wageIncome = input.wageIncome ?? {};
  const account = input.account ?? {};
  const transactionCodes = [...new Set((account.transactionCodes ?? input.transactionCodes ?? []).map(Number).filter(Number.isFinite))];
  const flags = [...new Set(input.flags ?? [])];
  const mismatches = {
    wages: Math.abs(amount(returnData.wages) - amount(wageIncome.wages)),
    withholding: Math.abs(amount(returnData.withholding) - amount(wageIncome.withholding)),
    businessIncome: Math.abs(amount(returnData.businessIncome) - amount(wageIncome.nonemployeeCompensation)),
    cancellationOfDebtOmitted: amount(wageIncome.cancellationOfDebt) > 0 && amount(returnData.cancellationOfDebt) === 0
  };
  return {
    id: input.id ?? randomUUID(),
    taxpayerRef: String(input.taxpayerRef ?? 'masked'),
    taxYear: Number(input.taxYear),
    noticeCode: String(input.noticeCode ?? '').toUpperCase().replace(/\s+/g, ''),
    taxpayerDeniedFiling: input.taxpayerDeniedFiling === true,
    unauthorizedReturn: input.unauthorizedReturn === true,
    amendedReturns: Number(input.amendedReturns ?? 0),
    highRiskCredit: input.highRiskCredit === true,
    flags,
    returnData,
    wageIncome,
    account: { ...account, transactionCodes },
    transactionCodes,
    mismatches,
    refundReversalDetected: input.refundReversalDetected === true || transactionCodes.includes(codes.REFUND_CANCELLED),
    holdPresent: transactionCodes.includes(codes.HOLD) || account.tc570 === true,
    freezePresent: transactionCodes.includes(codes.REFUND_FREEZE) || account.tc810 === true
  };
}

export function buildResolutionPlan(input = {}) {
  const c = normalizeCase(input);
  const matched = lanes.filter((lane) => lane.match(c));
  const primary = matched[0];
  const tasks = [
    ['Verify taxpayer identity and authorization posture', 'Human practitioner', 'CRITICAL'],
    ['Acquire current approved transcripts', 'Transcript specialist', 'HIGH'],
    ['Reconcile return to third-party information by payer', 'Reconciliation analyst', 'HIGH'],
    [`Route to ${primary.id}`, primary.owner, primary.severity],
    ['Assemble hashed exhibit index', 'Evidence specialist', 'HIGH'],
    ['Complete practitioner legal/factual review', 'Authorized practitioner', 'CRITICAL'],
    ['Obtain taxpayer adoption and signature', 'Taxpayer', 'CRITICAL'],
    ['Submit through notice-authorized channel', 'Correspondence operator', 'HIGH'],
    ['Monitor authoritative account events', 'Monitoring worker', 'MEDIUM']
  ].map(([title, owner, priority], index) => ({ id: `TASK-${String(index + 1).padStart(3, '0')}`, title, owner, priority }));

  const plan = {
    engine: ENGINE,
    generatedAt: new Date().toISOString(),
    status: c.holdPresent || c.freezePresent || primary.severity === 'CRITICAL' ? 'HOLD_FOR_EVIDENCE_AND_IRS_DETERMINATION' : 'READY_FOR_HUMAN_REVIEW',
    case: c,
    primaryLane: primary.id,
    secondaryLanes: matched.slice(1).map((x) => x.id).filter((x) => x !== 'GENERAL_PROCESSING_HOLD'),
    severity: primary.severity,
    ownerFunction: primary.owner,
    evidenceChecklist: [...new Set(matched.flatMap((x) => x.evidence))],
    requiredActions: [...new Set(matched.flatMap((x) => x.actions))],
    tasks,
    monitoringCodes: [570, 571, 810, 811, 846, 841, 971, 977, 290, 291],
    prohibitedActions: [
      'No claim that private software can remove TC 570 or TC 810.',
      'No fabricated income, withholding, credits, signatures or account activity.',
      'No duplicate or contradictory amended return without supersession reconciliation.',
      'No refund approval status without an authoritative IRS event.'
    ],
    tasGate: 'Current fact-specific TAS eligibility review required; restrictions may apply to RIVO and unreversed TC 810 cases.'
  };
  plan.integrityHash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return plan;
}

export function laneCatalog() {
  return lanes.map(({ id, severity, owner }) => ({ id, severity, owner }));
}
