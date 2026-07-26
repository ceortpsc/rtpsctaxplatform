/**
 * Build ordered federal refund TimelineEvent stages from a normalized ledger row.
 */

import { phraseForEro } from '../../ero-ops/src/index.mjs';

const STAGE_ORDER = Object.freeze([
  'ingested',
  'transmitted',
  'accepted',
  'rejected',
  'funded',
  'fees_settled',
  'protections',
  'closed'
]);

function event(stage, label, details = {}, phrase = null) {
  return {
    id: null, // assigned by store
    stage,
    label,
    details,
    phrase,
    createdAt: null // assigned by store
  };
}

function clientPhrase(row, statusPhrase) {
  try {
    return phraseForEro('REFUND-STATUS-CLIENT', {
      clientName: row.clientName,
      taxpayerRef: row.taxpayerRef,
      statusPhrase,
      eroName: row.preparer || 'your tax professional'
    });
  } catch {
    return null;
  }
}

function eroPhrase(row, stage, detail) {
  try {
    return phraseForEro('ERO-INTERNAL-TRACE', {
      clientName: row.clientName,
      taxpayerRef: row.taxpayerRef,
      stage,
      detail,
      productCode: row.bankProduct || row.product || 'FED',
      provider: 'SBTPG/Treasury-trace'
    });
  } catch {
    return null;
  }
}

/** Map ack code to accepted/rejected stage. */
export function resolveAckStage(ackCode) {
  const code = String(ackCode || '').toUpperCase();
  if (!code) return null;
  if (code === 'A' || code === 'C') return 'accepted';
  if (code === 'R' || code === 'P' || code === 'O') return 'rejected';
  return null;
}

/**
 * Build the full federal refund trace timeline for one ledger row.
 */
export function buildFederalTraceTimeline(row) {
  const events = [];

  events.push(
    event(
      'ingested',
      'Case ingested from approved Full Report Export',
      {
        returnId: row.returnId,
        taxpayerRef: row.taxpayerRef,
        amount: row.refund,
        formType: row.formType,
        source: row.source
      },
      clientPhrase(row, 'your federal return is on file with our refund center')
    )
  );

  if (row.transmitDate) {
    events.push(
      event(
        'transmitted',
        'Return transmitted to IRS',
        {
          transmitDate: row.transmitDate,
          processDate: row.processDate,
          bankProduct: row.bankProduct,
          product: row.product
        },
        clientPhrase(row, 'your return was transmitted to the IRS')
      )
    );
  }

  const ackStage = resolveAckStage(row.ackCode);
  if (ackStage === 'accepted') {
    events.push(
      event(
        'accepted',
        'IRS accepted return',
        { ackDate: row.ackDate, ackCode: row.ackCode },
        clientPhrase(row, 'the IRS accepted your return')
      )
    );
  } else if (ackStage === 'rejected') {
    events.push(
      event(
        'rejected',
        'IRS rejected or exception on return',
        { ackDate: row.ackDate, ackCode: row.ackCode },
        clientPhrase(row, 'the IRS reported an exception on your return')
      )
    );
  }

  if (row.fundedDate || (row.refund != null && row.refund > 0 && ackStage === 'accepted')) {
    events.push(
      event(
        'funded',
        'Refund funded via SBTPG / bank product channel',
        {
          fundedDate: row.fundedDate,
          refund: row.refund,
          bankProduct: row.bankProduct
        },
        clientPhrase(row, 'your refund funding has posted')
      )
    );
  }

  const feeDetails = {
    prepFee: row.prepFee,
    efileFee: row.efileFee
  };
  if (feeDetails.prepFee != null || feeDetails.efileFee != null) {
    events.push(
      event('fees_settled', 'ERO / transmission fees recorded on ledger', feeDetails, eroPhrase(row, 'fees_settled', 'Fee columns captured from Full Report Export'))
    );
  }

  if (row.auditProduct || row.idTheftProduct) {
    events.push(
      event(
        'protections',
        'Taxpayer protections on file',
        {
          auditProduct: row.auditProduct,
          idTheftProduct: row.idTheftProduct
        },
        clientPhrase(row, 'your Audit Maintenance Pro / SecurelyID protections are on file')
      )
    );
  }

  const funded = Boolean(row.fundedDate) || (row.refund != null && row.refund > 0 && ackStage === 'accepted');
  const feesOk = feeDetails.prepFee != null || feeDetails.efileFee != null;
  if (funded && feesOk && ackStage === 'accepted') {
    events.push(
      event(
        'closed',
        'Refund case completed',
        { returnId: row.returnId, refund: row.refund },
        clientPhrase(row, 'your federal refund case is complete')
      )
    );
  }

  return {
    caseId: `CASE-${(row.returnId || row.taxpayerRef || 'UNK').toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()}`,
    taxpayerRef: row.taxpayerRef,
    amount: row.refund,
    filingStage: funded ? 'paid' : ackStage === 'accepted' ? 'approved' : row.transmitDate ? 'sent' : 'received',
    source: 'api',
    latestStage: events[events.length - 1]?.stage ?? 'ingested',
    ledger: {
      returnId: row.returnId,
      lastFour: row.lastFour,
      clientName: row.clientName,
      bankProduct: row.bankProduct,
      transmitDate: row.transmitDate,
      ackCode: row.ackCode,
      fundedDate: row.fundedDate,
      refund: row.refund
    },
    timeline: events,
    stages: STAGE_ORDER
  };
}

export { STAGE_ORDER };
