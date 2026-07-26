/**
 * @rtp/federal-refund-trace
 *
 * Federal refund trace module for Full Report Export (SBTPG federal returns filled).
 * Builds RefundCase + TimelineEvent stages with full client/ERO phrasing.
 * Approved ledger ingest only — no scraping / no live IRS.
 */

export {
  parseFullReportExport,
  loadFullReportExportFile,
  normalizeFederalReturnRow,
  stripExcel,
  parseMoney,
  parseDate
} from './csv.mjs';

export { buildFederalTraceTimeline, resolveAckStage, STAGE_ORDER } from './timeline.mjs';

import { parseFullReportExport, loadFullReportExportFile } from './csv.mjs';
import { buildFederalTraceTimeline } from './timeline.mjs';

/** Build case+timeline traces for every row in a Full Report Export parse result. */
export function buildFederalTraces(parseResult) {
  const rows = parseResult?.rows ?? [];
  const traces = rows.map((row) => buildFederalTraceTimeline(row));
  return {
    count: traces.length,
    source: parseResult?.source ?? 'full-report-export',
    traces
  };
}

/** Load ledger file and build all federal refund traces. */
export async function loadAndTraceFederalLedger(filePath) {
  const parsed = await loadFullReportExportFile(filePath);
  return { parsed, ...buildFederalTraces(parsed) };
}

/** Find a trace by taxpayerRef, returnId, or lastFour. */
export function findFederalTrace(traces, query = {}) {
  const qRef = query.taxpayerRef ? String(query.taxpayerRef).toUpperCase() : null;
  const qReturn = query.returnId ? String(query.returnId).toLowerCase() : null;
  const qLast4 = query.lastFour ? String(query.lastFour).replace(/\D/g, '').slice(-4) : null;
  return (
    traces.find((t) => {
      if (qRef && String(t.taxpayerRef).toUpperCase() === qRef) return true;
      if (qReturn && String(t.ledger?.returnId || '').toLowerCase() === qReturn) return true;
      if (qLast4 && String(t.ledger?.lastFour || '') === qLast4) return true;
      return false;
    }) ?? null
  );
}

export function describeFederalRefundTraceModule() {
  return {
    name: '@rtp/federal-refund-trace',
    title: 'Federal Refund Trace',
    policy: 'Approved Full Report Export ledger only — no scraping.',
    stages: ['ingested', 'transmitted', 'accepted', 'rejected', 'funded', 'fees_settled', 'protections', 'closed'],
    keys: ['taxpayerRef', 'returnId', 'lastFour'],
    commands: [
      'POST /rtpsc/cases/ingest',
      'POST /rtpsc/cases/:caseId/run-full-path',
      'POST /rtpsc/ledger/import'
    ]
  };
}
