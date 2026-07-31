import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const tcCodeEngine = createEngineDescriptor({
  name: 'tc-code-engine',
  capabilities: [
    'tc-code-catalog',
    'indicator-tagging',
    'masterfile-enrichment',
    'refund-impact-classification',
    'hold-signal-detection'
  ],
  outputs: ['tc-code-indicator', 'analytics-tag', 'masterfile-enrichment', 'hold-signals']
});

/** Common IRS Transaction Codes (TC) used in refund / masterfile workflows. */
export const TC_CODE_CATALOG = Object.freeze([
  {
    code: '150',
    name: 'Return filed and tax assessed',
    category: 'assessment',
    refundImpact: 'neutral',
    hold: false,
    tags: ['filed', 'assessment']
  },
  {
    code: '290',
    name: 'Additional tax assessment',
    category: 'assessment',
    refundImpact: 'reduce',
    hold: false,
    tags: ['assessment', 'adjustment']
  },
  {
    code: '291',
    name: 'Abatement of prior tax assessment',
    category: 'abatement',
    refundImpact: 'increase',
    hold: false,
    tags: ['abatement']
  },
  {
    code: '570',
    name: 'Additional account action pending',
    category: 'freeze',
    refundImpact: 'hold',
    hold: true,
    tags: ['hold', 'freeze', 'review']
  },
  {
    code: '571',
    name: 'Remove TC 570 freeze',
    category: 'release',
    refundImpact: 'release',
    hold: false,
    tags: ['release', 'unfreeze']
  },
  {
    code: '810',
    name: 'Refund freeze',
    category: 'freeze',
    refundImpact: 'hold',
    hold: true,
    tags: ['hold', 'refund-freeze']
  },
  {
    code: '811',
    name: 'Remove refund freeze',
    category: 'release',
    refundImpact: 'release',
    hold: false,
    tags: ['release', 'refund']
  },
  {
    code: '840',
    name: 'Refund issued',
    category: 'refund',
    refundImpact: 'disbursed',
    hold: false,
    tags: ['refund', 'disbursed']
  },
  {
    code: '841',
    name: 'Cancelled refund check / EFT',
    category: 'refund',
    refundImpact: 'reverse',
    hold: false,
    tags: ['refund', 'cancelled']
  },
  {
    code: '846',
    name: 'Refund of overpayment',
    category: 'refund',
    refundImpact: 'disbursed',
    hold: false,
    tags: ['refund', 'overpayment']
  },
  {
    code: '971',
    name: 'Miscellaneous action / notice issued',
    category: 'notice',
    refundImpact: 'neutral',
    hold: false,
    tags: ['notice', 'misc']
  },
  {
    code: '976',
    name: 'Posted duplicate return',
    category: 'exception',
    refundImpact: 'hold',
    hold: true,
    tags: ['duplicate', 'exception']
  }
]);

const BY_CODE = Object.freeze(Object.fromEntries(TC_CODE_CATALOG.map((entry) => [entry.code, entry])));

export function listTcCodes({ category, hold } = {}) {
  return TC_CODE_CATALOG.filter((entry) => {
    if (category && entry.category !== category) return false;
    if (hold === true && !entry.hold) return false;
    if (hold === false && entry.hold) return false;
    return true;
  });
}

export function lookupTcCode(code) {
  const normalized = String(code || '')
    .trim()
    .replace(/^TC\s*/i, '');
  const entry = BY_CODE[normalized];
  if (!entry) {
    return { ok: false, code: 'not_found', message: `Unknown TC code: ${code}` };
  }
  return { ok: true, indicator: entry };
}

export function tagIndicators(codes = []) {
  const tags = new Set();
  const matched = [];
  const unknown = [];
  for (const raw of codes) {
    const result = lookupTcCode(raw);
    if (!result.ok) {
      unknown.push(String(raw));
      continue;
    }
    matched.push(result.indicator);
    for (const tag of result.indicator.tags) tags.add(tag);
  }
  return {
    engine: tcCodeEngine.name,
    matched,
    unknown,
    tags: [...tags].sort(),
    holdSignals: matched.filter((entry) => entry.hold).map((entry) => entry.code)
  };
}

/**
 * Enrich a masterfile-style record with TC indicators and analytics tags.
 */
export function enrichMasterfile(record = {}) {
  const codes = record.tcCodes || record.transactionCodes || [];
  const tagged = tagIndicators(codes);
  const primaryHold = tagged.holdSignals[0] || null;

  return {
    engine: tcCodeEngine.name,
    recordId: record.id || record.tinHash || null,
    taxYear: record.taxYear || null,
    indicators: tagged.matched,
    analyticsTags: tagged.tags,
    holdSignals: tagged.holdSignals,
    unknownCodes: tagged.unknown,
    refundImpact: primaryHold
      ? 'hold'
      : tagged.matched.some((m) => m.refundImpact === 'disbursed')
        ? 'disbursed'
        : tagged.matched.some((m) => m.refundImpact === 'increase')
          ? 'increase'
          : tagged.matched.some((m) => m.refundImpact === 'reduce')
            ? 'reduce'
            : 'neutral',
    outputs: tcCodeEngine.outputs,
    compliance: tcCodeEngine.compliance
  };
}
