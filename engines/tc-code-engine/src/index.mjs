import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const tcCodeEngine = createEngineDescriptor({
  name: 'tc-code-engine',
  capabilities: [
    'tc-code-catalog',
    'indicator-tagging',
    'masterfile-enrichment',
    'tc-570-hold-rectification',
    'tc-810-credit-elect-rectification',
    'refund-release-gate'
  ],
  outputs: ['tc-code-indicator', 'analytics-tag', 'rectification-result', 'release-eligibility']
});

/** Core masterfile transaction codes used by ERO refund release workflows. */
export const TC_CATALOG = Object.freeze([
  Object.freeze({ code: '150', label: 'Return filed', category: 'filing', hold: false, creditElect: false }),
  Object.freeze({ code: '570', label: 'Additional liability pending / hold', category: 'hold', hold: true, creditElect: false }),
  Object.freeze({ code: '571', label: 'Additional tax assessment', category: 'assessment', hold: true, creditElect: false }),
  Object.freeze({ code: '810', label: 'Refund freeze / credit elect', category: 'freeze', hold: true, creditElect: true }),
  Object.freeze({ code: '811', label: 'Refund freeze released', category: 'release', hold: false, creditElect: false }),
  Object.freeze({ code: '846', label: 'Refund issued', category: 'issuance', hold: false, creditElect: false }),
  Object.freeze({ code: '971', label: 'Miscellaneous / notice indicator', category: 'notice', hold: false, creditElect: false })
]);

const HOLD_CODES = new Set(TC_CATALOG.filter((c) => c.hold).map((c) => c.code));

export function findTcCode(code) {
  return TC_CATALOG.find((c) => c.code === String(code)) ?? null;
}

export function listHoldCodes() {
  return TC_CATALOG.filter((c) => c.hold);
}

/**
 * Analyze masterfile TC list for holds that block refund release.
 */
export function analyzeTransactionCodes(codes = []) {
  const normalized = (Array.isArray(codes) ? codes : []).map((entry) => {
    const code = String(typeof entry === 'object' ? entry.code : entry);
    const meta = findTcCode(code) || { code, label: 'Unknown TC', category: 'unknown', hold: false, creditElect: false };
    const status = typeof entry === 'object' ? entry.status || (entry.rectified ? 'rectified' : 'open') : 'open';
    const rectified = typeof entry === 'object' ? entry.rectified === true || status === 'rectified' : false;
    return {
      code: meta.code,
      label: meta.label,
      category: meta.category,
      hold: meta.hold === true,
      creditElect: meta.creditElect === true,
      status,
      rectified,
      notes: typeof entry === 'object' ? entry.notes || '' : ''
    };
  });

  const openHolds = normalized.filter((c) => c.hold && !c.rectified);
  const rectifiedHolds = normalized.filter((c) => c.hold && c.rectified);
  const has570 = normalized.some((c) => c.code === '570');
  const has810 = normalized.some((c) => c.code === '810');
  const has846 = normalized.some((c) => c.code === '846');

  return {
    engine: tcCodeEngine.name,
    codes: normalized,
    openHolds,
    rectifiedHolds,
    has570,
    has810,
    has846,
    blocking: openHolds.length > 0,
    releaseEligible: openHolds.length === 0 && !has846
  };
}

/**
 * Rectify a hold TC (570 / 810) on a case after ERO masterfile review.
 * Does not call live IRS — records operational rectification intent.
 */
export function rectifyTransactionCode(input = {}) {
  const code = String(input.code || '').trim();
  if (!HOLD_CODES.has(code) && code !== '570' && code !== '810') {
    throw new Error(`TC ${code || '(empty)'} is not a supported hold/freeze rectification code (570/810).`);
  }
  const caseId = String(input.caseId || '').trim();
  if (!caseId) throw new Error('caseId is required for TC rectification.');
  const analysis = analyzeTransactionCodes(input.codes || [{ code, status: 'open' }]);
  const target = analysis.codes.find((c) => c.code === code) || {
    code,
    label: findTcCode(code)?.label || code,
    hold: true,
    creditElect: code === '810',
    status: 'open',
    rectified: false
  };

  const rectified = {
    ...target,
    status: 'rectified',
    rectified: true,
    notes: String(input.notes || `ERO rectified TC ${code} after masterfile review.`),
    rectifiedAt: input.at || new Date().toISOString(),
    rectifiedBy: input.operator || 'ero',
    liveIrsAdjustmentApplied: false
  };

  const nextCodes = [
    ...analysis.codes.filter((c) => c.code !== code),
    rectified
  ];
  // Preserve companion codes if only one was passed
  if (!input.codes?.length && code === '570') {
    nextCodes.push(
      { code: '150', label: findTcCode('150').label, hold: false, creditElect: false, status: 'posted', rectified: false, notes: '' }
    );
  }

  const next = analyzeTransactionCodes(nextCodes);
  return {
    caseId,
    taxpayerRef: input.taxpayerRef ? String(input.taxpayerRef) : null,
    code,
    rectified,
    analysis: next,
    releaseEligible: next.releaseEligible,
    event: {
      type: 'masterfile.tc.rectified',
      caseId,
      taxpayerRef: input.taxpayerRef || null,
      code,
      openHolds: next.openHolds.map((c) => c.code),
      releaseEligible: next.releaseEligible
    }
  };
}

export function evaluateRefundReleaseGate({ codes = [], masterfileRectified = false } = {}) {
  const analysis = analyzeTransactionCodes(codes);
  const holdsClear = analysis.openHolds.length === 0;
  const eligible = holdsClear && (masterfileRectified === true || analysis.rectifiedHolds.length > 0);
  const reasons = [];
  if (!holdsClear) reasons.push(`Open hold codes: ${analysis.openHolds.map((c) => c.code).join(', ')}`);
  if (holdsClear && !eligible) reasons.push('Masterfile rectification not recorded.');
  if (analysis.has846) reasons.push('TC 846 already posted — refund previously issued.');
  return {
    eligible: eligible && !analysis.has846,
    analysis,
    reasons,
    requiredActions: holdsClear
      ? analysis.has846
        ? ['reconcile-existing-issuance']
        : ['request-refund-release']
      : analysis.openHolds.map((c) => `rectify-tc-${c.code}`)
  };
}
