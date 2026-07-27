/**
 * @rtp/tax-prep — Professional tax-prep desk primitives for RTPSC.
 * Interview · form catalog · return workspace · diagnostics.
 * Local/heuristic only — not a live MeF calc engine.
 */

import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';
import {
  computeRefund,
  runOptimizationWorkflow,
  scanRefundableCredits
} from '../../../engines/refund-optimization-engine/src/index.mjs';
import { AI_HARD_PROHIBITIONS } from '../../ero-governance/src/index.mjs';

export const TAX_PREP_STAGES = Object.freeze([
  'intake',
  'interview',
  'documents',
  'review',
  'diagnostics',
  'ready_to_efile',
  'held',
  'transmitted'
]);

export const FORM_CATALOG = Object.freeze([
  { id: '1040', name: 'Form 1040', category: 'return', required: true },
  { id: 'sched-a', name: 'Schedule A (Itemized Deductions)', category: 'schedule', required: false },
  { id: 'sched-b', name: 'Schedule B (Interest and Dividends)', category: 'schedule', required: false },
  { id: 'sched-c', name: 'Schedule C (Business)', category: 'schedule', required: false },
  { id: 'sched-d', name: 'Schedule D (Capital Gains)', category: 'schedule', required: false },
  { id: 'sched-e', name: 'Schedule E (Supplemental Income)', category: 'schedule', required: false },
  { id: '8867', name: 'Form 8867 (Paid Preparer Due Diligence)', category: 'due-diligence', required: true },
  { id: 'w2', name: 'Form W-2', category: 'income', required: false },
  { id: '1099-nec', name: 'Form 1099-NEC', category: 'income', required: false },
  { id: '1099-int', name: 'Form 1099-INT', category: 'income', required: false }
]);

export const INTERVIEW_MODULES = Object.freeze([
  {
    id: 'identity',
    title: 'Taxpayer identity',
    prompt: 'Confirm legal name, SSN/ITIN presence, and contact channel.',
    fields: ['displayName', 'taxpayerRef', 'email', 'phone']
  },
  {
    id: 'filing-status',
    title: 'Filing status',
    prompt: 'Select filing status and household facts.',
    fields: ['filingStatus', 'spousePresent', 'qualifyingPerson']
  },
  {
    id: 'dependents',
    title: 'Dependents',
    prompt: 'List qualifying children and other dependents.',
    fields: ['qualifyingChildren', 'otherDependents']
  },
  {
    id: 'income',
    title: 'Income sources',
    prompt: 'Capture wages, self-employment, interest, and other income.',
    fields: ['wages', 'selfEmployment', 'interest', 'otherIncome', 'withholding']
  },
  {
    id: 'credits',
    title: 'Credits & due diligence',
    prompt: 'Flag EITC/CTC/education/marketplace facts for Form 8867.',
    fields: ['claimEitc', 'claimActc', 'educationExpenses', 'marketplacePremiums']
  },
  {
    id: 'bank-products',
    title: 'Bank products intent',
    prompt: 'Record refund-advance / RT interest without funding until gate opens.',
    fields: ['wantsRefundAdvance', 'wantsRefundTransfer']
  }
]);

let counter = 0;
function nextId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

function now() {
  return new Date().toISOString();
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAnswers(input = {}) {
  return {
    displayName: String(input.displayName ?? '').trim() || null,
    taxpayerRef: String(input.taxpayerRef ?? '').trim() || null,
    email: String(input.email ?? '').trim() || null,
    phone: String(input.phone ?? '').trim() || null,
    filingStatus: String(input.filingStatus ?? 'Single').trim() || 'Single',
    spousePresent: Boolean(input.spousePresent),
    qualifyingPerson: Boolean(input.qualifyingPerson),
    qualifyingChildren: Math.max(0, Math.floor(asNumber(input.qualifyingChildren))),
    otherDependents: Math.max(0, Math.floor(asNumber(input.otherDependents))),
    wages: asNumber(input.wages),
    selfEmployment: asNumber(input.selfEmployment),
    interest: asNumber(input.interest),
    otherIncome: asNumber(input.otherIncome),
    withholding: asNumber(input.withholding),
    taxLiability: asNumber(input.taxLiability),
    nonRefundableCredits: asNumber(input.nonRefundableCredits),
    claimEitc: Boolean(input.claimEitc),
    claimActc: Boolean(input.claimActc),
    educationExpenses: Boolean(input.educationExpenses),
    marketplacePremiums: Boolean(input.marketplacePremiums),
    wantsRefundAdvance: Boolean(input.wantsRefundAdvance),
    wantsRefundTransfer: Boolean(input.wantsRefundTransfer),
    documents: Array.isArray(input.documents) ? input.documents.map(String) : []
  };
}

/**
 * Run return diagnostics comparable to a Pro diagnostic strip —
 * completeness, due diligence, and e-file readiness (local rules).
 */
export function diagnoseReturn(answersInput = {}, { stage = 'diagnostics' } = {}) {
  const a = normalizeAnswers(answersInput);
  const findings = [];

  if (!a.displayName) {
    findings.push({
      code: 'ID-001',
      severity: 'error',
      area: 'identity',
      message: 'Taxpayer display name is required before review.'
    });
  }
  if (!a.taxpayerRef) {
    findings.push({
      code: 'ID-002',
      severity: 'warning',
      area: 'identity',
      message: 'Taxpayer reference missing — attach a stable client/taxpayer key.'
    });
  }

  if (a.filingStatus === 'MFJ' && !a.spousePresent) {
    findings.push({
      code: 'FS-001',
      severity: 'error',
      area: 'filing-status',
      message: 'Married Filing Jointly selected without spouse present flag.'
    });
  }
  if (a.filingStatus === 'HOH' && !a.qualifyingPerson && a.qualifyingChildren < 1) {
    findings.push({
      code: 'FS-002',
      severity: 'error',
      area: 'filing-status',
      message: 'Head of Household requires a qualifying person or child.'
    });
  }

  const earnedIncome = a.wages + a.selfEmployment;
  if (earnedIncome <= 0 && a.interest <= 0 && a.otherIncome <= 0) {
    findings.push({
      code: 'INC-001',
      severity: 'error',
      area: 'income',
      message: 'No income sources recorded — interview incomplete.'
    });
  }

  if (a.claimEitc || a.claimActc) {
    if (!a.documents.includes('8867')) {
      findings.push({
        code: 'DD-001',
        severity: 'error',
        area: 'due-diligence',
        message: 'EITC/ACTC claim requires Form 8867 due-diligence worksheet.'
      });
    }
    if (a.claimEitc && earnedIncome <= 0) {
      findings.push({
        code: 'DD-002',
        severity: 'error',
        area: 'due-diligence',
        message: 'EITC claim without earned income will fail diagnostics.'
      });
    }
  }

  if (a.selfEmployment > 0 && !a.documents.includes('sched-c') && !a.documents.includes('1099-nec')) {
    findings.push({
      code: 'DOC-001',
      severity: 'warning',
      area: 'documents',
      message: 'Self-employment income — attach Schedule C and/or 1099-NEC.'
    });
  }

  if (a.wages > 0 && !a.documents.includes('w2')) {
    findings.push({
      code: 'DOC-002',
      severity: 'warning',
      area: 'documents',
      message: 'Wage income recorded without W-2 on the document list.'
    });
  }

  const creditScan = scanRefundableCredits({
    earnedIncome,
    qualifyingChildren: a.qualifyingChildren,
    educationExpenses: a.educationExpenses,
    marketplacePremiums: a.marketplacePremiums,
    selfEmployed: a.selfEmployment > 0
  });

  const estimatedRefundable = creditScan
    .filter((c) => c.eligible && typeof c.maxApprox === 'number')
    .reduce((sum, c) => sum + (c.maxApprox || 0) * 0.35, 0);

  const refundMath = computeRefund({
    withholding: a.withholding,
    refundableCredits: estimatedRefundable,
    nonRefundableCredits: a.nonRefundableCredits,
    taxLiability: a.taxLiability || Math.max(0, earnedIncome * 0.12)
  });

  let optimization = null;
  try {
    optimization = runOptimizationWorkflow({
      filingStatus: a.filingStatus,
      earnedIncome,
      withholding: a.withholding,
      qualifyingChildren: a.qualifyingChildren,
      educationExpenses: a.educationExpenses,
      marketplacePremiums: a.marketplacePremiums,
      selfEmployed: a.selfEmployment > 0,
      taxLiability: refundMath.taxLiability
    });
  } catch {
    optimization = null;
  }

  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const ready = errors.length === 0 && ['diagnostics', 'ready_to_efile', 'review'].includes(stage);

  return {
    ok: errors.length === 0,
    readyToEfile: ready && errors.length === 0,
    stage,
    findings,
    counts: { errors: errors.length, warnings: warnings.length, info: 0 },
    creditScan,
    refundMath,
    optimization: optimization
      ? {
          scenarios: optimization.optimized?.scenarios?.length ?? 0,
          topBoost: optimization.recommendations?.[0] ?? null,
          guardFlags: optimization.risks ?? [],
          baselineRefund: optimization.baseline?.refund ?? null,
          optimizedRefund: optimization.optimized?.refund ?? null
        }
      : null,
    aiGuard: {
      notice: 'AI personas cannot transmit or clear material HOLD.',
      prohibitions: AI_HARD_PROHIBITIONS.slice(0, 4)
    },
    evaluatedAt: now()
  };
}

export function listInterviewModules() {
  return INTERVIEW_MODULES.map((m) => ({ ...m }));
}

export function listForms() {
  return FORM_CATALOG.map((f) => ({ ...f }));
}

export function createTaxPrepStore() {
  const returns = new Map();

  function createReturn(input = {}) {
    const answers = normalizeAnswers(input);
    const id = nextId('ret');
    const record = {
      id,
      taxYear: Number(input.taxYear) || new Date().getUTCFullYear() - 1,
      stage: 'intake',
      answers,
      selectedForms: Array.isArray(input.selectedForms)
        ? input.selectedForms.map(String)
        : FORM_CATALOG.filter((f) => f.required).map((f) => f.id),
      diagnostics: null,
      createdAt: now(),
      updatedAt: now()
    };
    returns.set(id, record);
    return publicReturn(record);
  }

  function get(id) {
    const record = returns.get(id);
    return record ? publicReturn(record) : null;
  }

  function list() {
    return [...returns.values()]
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(publicReturn);
  }

  function updateInterview(id, patch = {}) {
    const record = returns.get(id);
    if (!record) throw new Error(`Unknown return: ${id}`);
    record.answers = normalizeAnswers({ ...record.answers, ...patch });
    if (Array.isArray(patch.documents)) {
      record.answers.documents = patch.documents.map(String);
    }
    if (Array.isArray(patch.selectedForms)) {
      record.selectedForms = patch.selectedForms.map(String);
    }
    if (record.stage === 'intake') record.stage = 'interview';
    record.updatedAt = now();
    return publicReturn(record);
  }

  function advance(id, stage) {
    const record = returns.get(id);
    if (!record) throw new Error(`Unknown return: ${id}`);
    if (!TAX_PREP_STAGES.includes(stage)) throw new Error(`Unknown stage: ${stage}`);
    if (stage === 'transmitted') {
      throw new Error('Transmission requires human approval and a live secure tunnel — held by policy.');
    }
    record.stage = stage;
    record.updatedAt = now();
    return publicReturn(record);
  }

  function runDiagnostics(id) {
    const record = returns.get(id);
    if (!record) throw new Error(`Unknown return: ${id}`);
    record.stage = 'diagnostics';
    record.diagnostics = diagnoseReturn(record.answers, { stage: 'diagnostics' });
    if (record.diagnostics.ok) record.stage = 'ready_to_efile';
    else record.stage = 'held';
    record.updatedAt = now();
    return {
      return: publicReturn(record),
      diagnostics: record.diagnostics
    };
  }

  function publicReturn(record) {
    return {
      id: record.id,
      taxYear: record.taxYear,
      stage: record.stage,
      answers: { ...record.answers },
      selectedForms: [...record.selectedForms],
      diagnostics: record.diagnostics,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  return {
    createReturn,
    get,
    list,
    updateInterview,
    advance,
    runDiagnostics,
    listInterviewModules,
    listForms,
    diagnoseReturn
  };
}

export function describeTaxPrep() {
  return {
    name: '@rtp/tax-prep',
    version: '0.1.0',
    role: 'Professional tax-prep interview, forms catalog, and return diagnostics',
    company: PLATFORM_IDENTITY.company,
    stages: [...TAX_PREP_STAGES],
    forms: FORM_CATALOG.length,
    interviewModules: INTERVIEW_MODULES.length,
    differentiator:
      'Pairs interview + Form 8867 due diligence with Refund Optimization Intelligence before e-file hold.',
    notice: 'Heuristic desk — not a substitute for a signed return or live MeF transmission.'
  };
}
