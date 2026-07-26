// ERO operations center helpers: SBTPG report tracking/tracing, automated
// phrasing for ERO software use, and refund-intelligence scoring.
// Local/stub — no live SBTPG or IRS calls. Zero external deps.

import { findProduct, REFUND_ADVANCE_PRODUCTS, SBTPG_PROVIDER, evaluatePaymentGate } from '../../bank-products/src/index.mjs';
import { refundIntelligenceEngine } from '../../../engines/refund-intelligence-engine/src/index.mjs';
import { PLATFORM_IDENTITY, loadRuntimeConfig } from '../../platform-core/src/index.mjs';

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

export const ERO_PHRASE_TEMPLATES = Object.freeze([
  Object.freeze({
    code: 'REFUND-STATUS-CLIENT',
    audience: 'client',
    title: 'Refund status update',
    template:
      'Hello {{clientName}}, this is {{eroName}} with {{company}}. We are tracking your refund status (ref {{taxpayerRef}}). Current signal: {{statusPhrase}}. We will notify you when the next milestone posts.'
  }),
  Object.freeze({
    code: 'SBTPG-ENROLL-ACK',
    audience: 'client',
    title: 'Bank product enrollment acknowledgment',
    template:
      'Hello {{clientName}}, thank you for reviewing the {{productName}} disclosures. Your enrollment ({{enrollmentId}}) is recorded. Funding remains subject to bank approval and platform payment-gate safeguards.'
  }),
  Object.freeze({
    code: 'POS-RECEIPT-FOLLOWUP',
    audience: 'client',
    title: 'POS / service receipt follow-up',
    template:
      'Hello {{clientName}}, thank you for visiting {{company}}. Sale {{saleNumber}} totaling ${{total}} is confirmed ({{paymentMethod}}). Retain your receipt for your records. Questions? Contact your ERO desk.'
  }),
  Object.freeze({
    code: 'ERO-INTERNAL-TRACE',
    audience: 'ero',
    title: 'Internal SBTPG trace note',
    template:
      '[ERO] Trace {{traceId}} · provider {{provider}} · product {{productCode}} · stage {{stage}} · contact {{clientName}} ({{taxpayerRef}}). {{detail}}'
  }),
  Object.freeze({
    code: 'REFUND-INTEL-BRIEF',
    audience: 'ero',
    title: 'Refund intelligence brief',
    template:
      '[Intel] {{clientName}} score {{score}}/100 ({{band}}). Drivers: {{drivers}}. Recommended action: {{recommendation}}.'
  })
]);

export function listPhraseTemplates() {
  return ERO_PHRASE_TEMPLATES.map((t) => ({ ...t }));
}

/** Fill an ERO phrase template with context values. */
export function phraseForEro(code, context = {}) {
  const tpl = ERO_PHRASE_TEMPLATES.find((t) => t.code === code);
  if (!tpl) throw new Error(`Unknown phrase template: ${code}`);
  const vars = {
    company: PLATFORM_IDENTITY.company,
    eroName: context.eroName ?? 'your tax professional',
    clientName: context.clientName ?? 'Client',
    taxpayerRef: context.taxpayerRef ?? 'n/a',
    statusPhrase: context.statusPhrase ?? 'under review',
    productName: context.productName ?? 'bank product',
    enrollmentId: context.enrollmentId ?? 'pending',
    saleNumber: context.saleNumber ?? 'n/a',
    total: context.total ?? '0.00',
    paymentMethod: context.paymentMethod ?? 'n/a',
    traceId: context.traceId ?? 'n/a',
    provider: context.provider ?? SBTPG_PROVIDER.code,
    productCode: context.productCode ?? 'n/a',
    stage: context.stage ?? 'recorded',
    detail: context.detail ?? '',
    score: context.score ?? 0,
    band: context.band ?? 'unknown',
    drivers: context.drivers ?? 'none',
    recommendation: context.recommendation ?? 'monitor'
  };
  let text = tpl.template;
  for (const [key, value] of Object.entries(vars)) {
    text = text.replaceAll(`{{${key}}}`, String(value));
  }
  return {
    code: tpl.code,
    audience: tpl.audience,
    title: tpl.title,
    text,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Local refund-intelligence score (0–100) from operational signals.
 * Complements the refund-intelligence-engine descriptor — no live IRS data.
 */
export function scoreRefundIntelligence(signals = {}) {
  let score = 50;
  const drivers = [];

  if (signals.hasTranscript === true) {
    score += 10;
    drivers.push('transcript on file');
  }
  if (signals.refundStatus) {
    const status = String(signals.refundStatus).toLowerCase();
    if (/paid|deposit|issued/.test(status)) {
      score += 20;
      drivers.push(`refund status: ${status}`);
    } else if (/delay|review|hold|offset/.test(status)) {
      score -= 15;
      drivers.push(`refund friction: ${status}`);
    } else {
      drivers.push(`refund status: ${status}`);
    }
  }
  if (signals.sbtpgEnrolled === true) {
    score += 5;
    drivers.push('SBTPG enrollment on file');
  }
  if (signals.paymentGateBlocked === true) {
    score -= 5;
    drivers.push('payment gate blocked (expected in non-prod)');
  }
  if (Number(signals.daysSinceFiling) >= 21) {
    score -= 8;
    drivers.push('extended days since filing');
  }
  if (signals.posPaid === true) {
    score += 4;
    drivers.push('POS sale settled');
  }

  score = Math.max(0, Math.min(100, score));
  const band = score >= 75 ? 'strong' : score >= 50 ? 'watch' : 'elevate';
  const recommendation =
    band === 'strong'
      ? 'Continue monitoring; prepare client status phrase.'
      : band === 'watch'
        ? 'Review SBTPG/refund traces and update the client within 1 business day.'
        : 'Escalate in the refund intelligence center; verify holds/offsets before bank-product messaging.';

  return {
    engine: refundIntelligenceEngine.name,
    capabilities: refundIntelligenceEngine.capabilities,
    score,
    band,
    drivers: drivers.length ? drivers : ['baseline'],
    recommendation,
    scoredAt: new Date().toISOString()
  };
}

/** In-memory SBTPG report tracking / tracing store. */
export function createSbtpgTraceStore({ idFactory, now = () => new Date().toISOString() } = {}) {
  const nextId = idFactory ?? defaultId;
  const traces = [];

  function trackReport(input = {}) {
    const stage = String(input.stage ?? 'received').trim() || 'received';
    const productCode = input.productCode ? String(input.productCode).trim().toUpperCase() : null;
    if (productCode && !findProduct(productCode)) throw new Error(`Unknown SBTPG product: ${productCode}`);
    const createdAt = now();
    const trace = {
      id: nextId('sbt'),
      provider: SBTPG_PROVIDER.code,
      productCode,
      stage,
      contactId: input.contactId ?? null,
      taxpayerRef: input.taxpayerRef ?? null,
      enrollmentId: input.enrollmentId ?? null,
      externalReportId: input.externalReportId ?? null,
      detail: String(input.detail ?? '').trim(),
      payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
      createdAt,
      events: [{ at: createdAt, stage, detail: String(input.detail ?? '').trim() || `stage=${stage}` }]
    };
    traces.unshift(trace);
    if (traces.length > 1000) traces.length = 1000;
    return trace;
  }

  function appendEvent(traceId, { stage, detail } = {}) {
    const trace = traces.find((t) => t.id === traceId);
    if (!trace) throw new Error(`Unknown trace: ${traceId}`);
    const at = now();
    if (stage) trace.stage = String(stage).trim() || trace.stage;
    const event = { at, stage: trace.stage, detail: String(detail ?? '').trim() };
    trace.events.push(event);
    if (detail) trace.detail = event.detail;
    return trace;
  }

  function listTraces({ contactId, limit = 50 } = {}) {
    const pool = contactId ? traces.filter((t) => t.contactId === contactId) : traces;
    return pool.slice(0, limit);
  }

  function findTrace(id) {
    return traces.find((t) => t.id === id) ?? null;
  }

  function gateSnapshot(config = loadRuntimeConfig()) {
    return {
      provider: SBTPG_PROVIDER,
      products: REFUND_ADVANCE_PRODUCTS.map((p) => ({ code: p.code, name: p.name, kind: p.kind })),
      paymentGate: evaluatePaymentGate({ config })
    };
  }

  return { trackReport, appendEvent, listTraces, findTrace, gateSnapshot, _traces: traces };
}
