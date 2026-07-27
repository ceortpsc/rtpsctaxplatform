import { createPipelineDescriptor } from '../../../packages/platform-core/src/index.mjs';
import {
  analyzeTransactionCodes,
  evaluateRefundReleaseGate,
  rectifyTransactionCode,
  tcCodeEngine
} from '../../../engines/tc-code-engine/src/index.mjs';

export const masterfilePipeline = createPipelineDescriptor({
  name: 'masterfile-pipeline',
  stages: [
    'ingest-approved-record',
    'normalize-masterfile',
    'enrich-tax-indicators',
    'publish-canonical-event',
    'rectify-hold-codes',
    'evaluate-refund-release-gate'
  ],
  outputs: [
    'canonical-masterfile-record',
    'indicator-event',
    'rectification-result',
    'refund-release-eligibility'
  ]
});

/**
 * Process an approved masterfile-shaped record through pipeline stages.
 * Live IRS adjustments stay false unless explicitly marked (never invent live).
 */
export function processMasterfileRecord(input = {}, { now = () => new Date().toISOString() } = {}) {
  const caseId = String(input.caseId || '').trim();
  if (!caseId) throw new Error('caseId is required for masterfile processing.');

  const stages = [];
  const ingested = {
    caseId,
    taxpayerRef: input.taxpayerRef ? String(input.taxpayerRef) : null,
    source: input.source || 'approved-irs-communications-tunnel-only',
    transactionCodes: input.transactionCodes || [
      { code: '150', status: 'posted' },
      { code: '570', status: 'open' },
      { code: '810', status: 'open' },
      { code: '971', status: 'open' }
    ],
    liveIrsMasterfileAdjustmentsApplied: input.liveIrsMasterfileAdjustmentsApplied === true,
    at: now()
  };
  stages.push({ stage: 'ingest-approved-record', ok: true });

  const normalized = {
    ...ingested,
    transactionCodes: analyzeTransactionCodes(ingested.transactionCodes).codes
  };
  stages.push({ stage: 'normalize-masterfile', ok: true });

  const analysis = analyzeTransactionCodes(normalized.transactionCodes);
  stages.push({
    stage: 'enrich-tax-indicators',
    ok: true,
    detail: { engine: tcCodeEngine.name, blocking: analysis.blocking }
  });

  const canonicalEvent = {
    type: 'masterfile.canonical.published',
    caseId,
    taxpayerRef: normalized.taxpayerRef,
    openHolds: analysis.openHolds.map((c) => c.code),
    at: now()
  };
  stages.push({ stage: 'publish-canonical-event', ok: true, event: canonicalEvent });

  let rectification = null;
  if (input.rectifyCodes?.length) {
    let codes = normalized.transactionCodes;
    for (const code of input.rectifyCodes) {
      rectification = rectifyTransactionCode({
        caseId,
        taxpayerRef: normalized.taxpayerRef,
        code,
        codes,
        notes: input.notes,
        operator: input.operator,
        at: now()
      });
      codes = rectification.analysis.codes;
    }
    stages.push({ stage: 'rectify-hold-codes', ok: true, rectification });
  } else {
    stages.push({ stage: 'rectify-hold-codes', ok: true, skipped: true });
  }

  const gate = evaluateRefundReleaseGate({
    codes: rectification?.analysis.codes || analysis.codes,
    masterfileRectified: Boolean(rectification)
  });
  stages.push({ stage: 'evaluate-refund-release-gate', ok: true, gate });

  return {
    pipeline: masterfilePipeline.name,
    caseId,
    taxpayerRef: normalized.taxpayerRef,
    liveIrsMasterfileAdjustmentsApplied: false,
    treasuryFiscalServicesConnected: false,
    sourceConstraint: 'approved-irs-communications-tunnel-only',
    analysis: rectification?.analysis || analysis,
    rectification,
    gate,
    stages,
    canonicalEvent,
    releaseEvent: rectification?.event || null
  };
}

export { analyzeTransactionCodes, evaluateRefundReleaseGate, rectifyTransactionCode };
