/**
 * Refund release + reconciliation after masterfile TC 570/810 rectification.
 * Fail-safe: issuance stays blocked without production transmission gates.
 */

import { evaluateEnvironmentProtection, PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';
import { evaluateRefundReleaseGate, analyzeTransactionCodes } from '../../../engines/tc-code-engine/src/index.mjs';
import { buildRefundIntelligence } from '../../../engines/refund-intelligence-engine/src/index.mjs';
import { scoreRefundIntelligence } from '../../ero-ops/src/index.mjs';
import {
  buildMasterfileRectificationXml,
  buildRefundReleaseRequestXml,
  buildRefundReconciliationXml
} from '../../irs-xml/src/index.mjs';

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

export function createRefundReleaseStore({
  idFactory,
  now = () => new Date().toISOString(),
  protection = () => evaluateEnvironmentProtection()
} = {}) {
  const nextId = idFactory ?? ((p) => defaultId(p));
  const requests = [];
  const reconciliations = [];

  function listRequests({ limit = 50, caseId } = {}) {
    let list = [...requests];
    if (caseId) list = list.filter((r) => r.caseId === caseId);
    return list.slice(0, limit);
  }

  function findRequest(id) {
    return requests.find((r) => r.id === id) ?? null;
  }

  function requestRelease(input = {}) {
    const caseId = String(input.caseId || '').trim();
    const taxpayerRef = String(input.taxpayerRef || '').trim();
    if (!caseId) throw new Error('caseId is required.');
    if (!taxpayerRef) throw new Error('taxpayerRef is required.');
    if (input.amount == null || Number.isNaN(Number(input.amount))) {
      throw new Error('amount is required.');
    }

    const codes = input.transactionCodes || input.codes || [];
    const gate = evaluateRefundReleaseGate({
      codes,
      masterfileRectified: input.masterfileRectified === true
    });
    if (!gate.eligible) {
      const err = new Error(`Refund release blocked: ${gate.reasons.join(' ') || 'holds open'}`);
      err.code = 'release_blocked';
      err.gate = gate;
      throw err;
    }

    const intel =
      input.intelligence ||
      buildRefundIntelligence({
        signals: {
          wmrStatus: 'APPROVED',
          masterfileStatus: 'APPROVED',
          transcriptStatus: 'ACCEPTED'
        }
      });
    const eroScore = scoreRefundIntelligence({
      hasTranscript: input.hasTranscript !== false,
      refundStatus: 'refund-approved',
      paymentGateBlocked: true
    });

    const createdAt = now();
    const env = protection();
    const guardLevel = typeof intel.guardLevel === 'object' ? intel.guardLevel.level : intel.guardLevel;
    const request = {
      id: nextId('rel'),
      caseId,
      taxpayerRef,
      amount: Number(input.amount),
      status: 'requested',
      approved: false,
      issued: false,
      masterfileRectified: true,
      clearedCodes: gate.analysis.rectifiedHolds.map((c) => c.code),
      openHolds: gate.analysis.openHolds.map((c) => c.code),
      intelligence: {
        band: eroScore.band || guardLevel,
        score: eroScore.score ?? intel.score,
        recommendation: eroScore.recommendation || (intel.exceptionRoutes || [])[0] || 'monitor',
        canonical: intel.refundStatusCanonical || null,
        guardLevel
      },
      transmissionAllowed: env.transmissionAllowed === true,
      requestedBy: input.requestedBy || 'ero',
      source: input.source || 'practitioner-suite',
      createdAt,
      updatedAt: createdAt,
      xml: null,
      events: [
        { at: createdAt, type: 'release-requested', detail: 'ERO refund release request after TC rectification' }
      ]
    };

    request.xml = buildRefundReleaseRequestXml({
      requestId: request.id,
      caseId,
      taxpayerRef,
      amount: request.amount,
      masterfileRectified: true,
      clearedCodes: request.clearedCodes,
      intelligenceBand: request.intelligence.band,
      guardLevel,
      requestedBy: request.requestedBy,
      requestedAt: createdAt,
      transmissionAllowed: request.transmissionAllowed
    });

    requests.unshift(request);
    if (requests.length > 500) requests.length = 500;
    return request;
  }

  function approveRelease(requestId, { approver = 'ero', force = false } = {}) {
    const request = findRequest(requestId);
    if (!request) throw new Error(`Unknown release request: ${requestId}`);
    if (request.issued) throw new Error('Release already issued.');
    const env = protection();
    if (!env.transmissionAllowed && !force) {
      request.status = 'approved-held';
      request.approved = true;
      request.updatedAt = now();
      request.events.unshift({
        at: request.updatedAt,
        type: 'approved-held',
        detail: 'Approved by ERO; issuance held — production transmission gates not clear.',
        approver
      });
      return request;
    }
    request.status = 'approved';
    request.approved = true;
    request.updatedAt = now();
    request.events.unshift({ at: request.updatedAt, type: 'approved', detail: 'Release approved', approver });
    return request;
  }

  /**
   * Issue refund after approval. Without transmission gates, records
   * scaffold issuance intent only (tc846Posted local footprint, not live IRS).
   */
  function issueRefund(requestId, { issuer = 'ero', scaffoldOnly = true } = {}) {
    const request = findRequest(requestId);
    if (!request) throw new Error(`Unknown release request: ${requestId}`);
    if (!request.approved) throw new Error('Release must be approved before issuance.');
    const env = protection();
    const live = env.transmissionAllowed === true && scaffoldOnly === false;
    request.issued = true;
    request.status = live ? 'issued-live' : 'issued-scaffold';
    request.tc846Posted = true;
    request.liveIrsIssuance = live === true;
    request.updatedAt = now();
    request.events.unshift({
      at: request.updatedAt,
      type: live ? 'issued-live' : 'issued-scaffold',
      detail: live
        ? 'Live issuance path cleared by production gates.'
        : 'Scaffold issuance recorded after rectification; live IRS 846 not transmitted.',
      issuer
    });
    return request;
  }

  function reconcile(input = {}) {
    const releaseRequestId = input.releaseRequestId || input.requestId;
    const request = releaseRequestId ? findRequest(releaseRequestId) : null;
    if (releaseRequestId && !request) throw new Error(`Unknown release request: ${releaseRequestId}`);
    const caseId = String(input.caseId || request?.caseId || '').trim();
    if (!caseId) throw new Error('caseId is required for reconciliation.');

    const amount = Number(input.amount ?? request?.amount ?? 0);
    const lines = input.lines || [
      { type: 'refund-approved', amount, detail: 'Approved refund amount' },
      { type: 'refund-issued', amount: request?.issued ? amount : 0, detail: request?.issued ? 'Issuance footprint' : 'Not issued' }
    ];
    const issuedAmt = lines.filter((l) => l.type === 'refund-issued').reduce((s, l) => s + Number(l.amount || 0), 0);
    const approvedAmt = lines.filter((l) => l.type === 'refund-approved').reduce((s, l) => s + Number(l.amount || 0), 0);
    const balanced = Math.abs(issuedAmt - approvedAmt) < 0.005 && (request?.issued === true || input.forceBalanced === true);

    const createdAt = now();
    const record = {
      id: nextId('rcn'),
      caseId,
      releaseRequestId: request?.id || null,
      taxpayerRef: input.taxpayerRef || request?.taxpayerRef || null,
      status: balanced ? 'reconciled' : 'variance',
      approved: request?.approved === true,
      issued: request?.issued === true,
      tc846Posted: request?.tc846Posted === true,
      balanced,
      lines,
      createdAt,
      xml: null
    };
    record.xml = buildRefundReconciliationXml({
      reconciliationId: record.id,
      caseId,
      releaseRequestId: record.releaseRequestId,
      status: record.status,
      approved: record.approved,
      issued: record.issued,
      tc846Posted: record.tc846Posted,
      lines,
      balanced,
      at: createdAt
    });
    reconciliations.unshift(record);
    if (reconciliations.length > 500) reconciliations.length = 500;
    if (request) {
      request.reconciliationId = record.id;
      request.updatedAt = createdAt;
      request.events.unshift({ at: createdAt, type: 'reconciled', detail: record.status });
    }
    return record;
  }

  function buildRectificationXml(input = {}) {
    return buildMasterfileRectificationXml(input);
  }

  function snapshot() {
    return {
      company: PLATFORM_IDENTITY.company,
      requests: requests.length,
      reconciliations: reconciliations.length,
      issued: requests.filter((r) => r.issued).length
    };
  }

  return {
    requestRelease,
    approveRelease,
    issueRefund,
    reconcile,
    listRequests,
    findRequest,
    listReconciliations: ({ limit = 50 } = {}) => reconciliations.slice(0, limit),
    buildRectificationXml,
    analyzeTransactionCodes,
    evaluateRefundReleaseGate,
    snapshot
  };
}
