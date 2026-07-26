// Full refund operations core: cases, timeline, approved-event ingest,
// pipeline stage execution, and intelligence. No scraping / no live IRS.

import { createWorkflowRegistry, createWorkflowRunner, createTriggerManager } from '../../workflow-engine/src/index.mjs';
import { refundStatusWorkflow } from '../../../workflows/refund-status-workflow/src/index.mjs';
import { refundStatusPipeline } from '../../../pipelines/refund-status-pipeline/src/index.mjs';
import { refundIntelligenceEngine } from '../../../engines/refund-intelligence-engine/src/index.mjs';
import { scoreRefundIntelligence } from '../../ero-ops/src/index.mjs';
import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';
import {
  buildFederalTraceTimeline,
  parseFullReportExport,
  findFederalTrace,
  buildFederalTraces
} from '../../federal-refund-trace/src/index.mjs';

const FILING_STAGES = Object.freeze(['received', 'processing', 'approved', 'sent', 'paid', 'delay', 'review', 'offset']);
const TRACE_STAGES = Object.freeze([
  'ingested',
  'transmitted',
  'accepted',
  'rejected',
  'funded',
  'fees_settled',
  'protections',
  'closed'
]);

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

/**
 * In-memory full refund case store with workflow + pipeline integration.
 */
export function createRefundStore({
  now = () => new Date().toISOString(),
  idFactory,
  workflow = refundStatusWorkflow
} = {}) {
  const nextId = idFactory ?? ((p) => defaultId(p));
  const cases = new Map();
  const events = [];
  const registry = createWorkflowRegistry([workflow]);
  const runner = createWorkflowRunner({ registry });
  const triggers = createTriggerManager({ registry, runner });

  function getCase(caseId) {
    return cases.get(String(caseId)) ?? null;
  }

  function listCases({ limit = 50, taxpayerRef } = {}) {
    let list = [...cases.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (taxpayerRef) list = list.filter((c) => c.taxpayerRef === taxpayerRef);
    return list.slice(0, limit);
  }

  function ensureCase(caseId, seed = {}) {
    const id = String(caseId);
    let record = cases.get(id);
    if (!record) {
      const createdAt = now();
      record = {
        id,
        caseId: id,
        taxpayerRef: seed.taxpayerRef ? String(seed.taxpayerRef) : 'unknown',
        status: 'status-unavailable',
        filingStage: seed.filingStage ?? 'received',
        latestStage: seed.latestStage ?? 'ingested',
        priority: 'low',
        riskScore: 0,
        intelligence: null,
        timeline: [],
        source: seed.source ?? 'manual',
        amount: seed.amount != null ? Number(seed.amount) : null,
        ledger: seed.ledger ?? null,
        createdAt,
        updatedAt: createdAt
      };
      cases.set(id, record);
    }
    return record;
  }

  function appendTimeline(record, entry) {
    const createdAt = now();
    record.timeline.unshift({
      id: entry.id ?? nextId('evt'),
      caseId: record.id,
      stage: entry.stage ?? entry.type ?? 'event',
      label: entry.label ?? entry.detail ?? entry.type ?? 'event',
      details: entry.details ?? {},
      phrase: entry.phrase ?? null,
      createdAt,
      // backward-compatible fields used by existing UI
      at: createdAt,
      type: entry.type ?? entry.stage ?? 'event',
      detail: entry.detail ?? entry.label ?? ''
    });
    if (entry.stage) record.latestStage = entry.stage;
    if (record.timeline.length > 200) record.timeline.length = 200;
    record.updatedAt = createdAt;
  }

  function runPipelineStages(record, event) {
    const outputs = [];
    for (const stage of refundStatusPipeline.stages) {
      const result = {
        stage,
        at: now(),
        caseId: record.id,
        ok: true
      };
      if (stage === 'ingest-approved-event') {
        result.detail = `Ingested ${event.type ?? 'event'} from ${event.source ?? 'approved'}`;
      } else if (stage === 'deduplicate') {
        const dup = record.timeline.some((t) => t.eventId && t.eventId === event.eventId);
        result.detail = dup ? 'Duplicate event ignored for status overwrite' : 'Unique event accepted';
        result.duplicate = dup;
      } else if (stage === 'update-status-timeline') {
        result.detail = `Timeline updated (${record.timeline.length} entries)`;
      } else if (stage === 'trigger-escalation-rules') {
        result.detail =
          record.priority === 'high' || record.intelligence?.band === 'elevate'
            ? 'Escalation recommended'
            : 'No escalation';
        result.escalate = record.priority === 'high' || record.intelligence?.band === 'elevate';
      }
      outputs.push(result);
      appendTimeline(record, { type: 'pipeline-stage', stage, detail: result.detail, pipeline: refundStatusPipeline.name });
    }
    return { pipeline: refundStatusPipeline.name, stages: outputs };
  }

  /**
   * Ingest an approved refund status event (no scraping).
   * Runs pipeline stages + refund-status-update workflow + intelligence.
   */
  async function ingestEvent(input = {}, meta = {}) {
    const caseId = input.caseId ?? input.id;
    if (!caseId) throw new Error('caseId is required.');
    const filingStage = String(input.filingStage ?? input.status ?? 'received').toLowerCase();
    if (!FILING_STAGES.includes(filingStage) && filingStage !== 'status-unavailable') {
      // allow unknown but mark
    }

    const event = {
      eventId: input.eventId ?? nextId('evt'),
      type: 'refund.status.received',
      caseId: String(caseId),
      taxpayerRef: input.taxpayerRef ?? 'unknown',
      filingStage,
      amount: input.amount != null ? Number(input.amount) : null,
      source: input.source ?? meta.source ?? 'approved-channel',
      receivedAt: now(),
      clientIdHint: meta.clientIdHint ?? null
    };
    events.unshift(event);
    if (events.length > 2000) events.length = 2000;

    const record = ensureCase(event.caseId, {
      taxpayerRef: event.taxpayerRef,
      filingStage: event.filingStage,
      source: event.source,
      amount: event.amount
    });
    if (event.taxpayerRef && event.taxpayerRef !== 'unknown') record.taxpayerRef = event.taxpayerRef;
    if (event.amount != null) record.amount = event.amount;
    record.filingStage = event.filingStage;
    record.source = event.source;

    appendTimeline(record, {
      type: 'event-ingested',
      eventId: event.eventId,
      detail: `Approved event ${event.eventId} (${event.filingStage})`,
      source: event.source
    });

    const pipelineResult = runPipelineStages(record, event);

    // Drive the modular workflow (same as background runner event path)
    const runs = await triggers.emit('refund.status.received', {
      caseId: event.caseId,
      taxpayerRef: record.taxpayerRef,
      filingStage: event.filingStage
    });
    const run = runs[0] ?? { status: 'failed', error: 'No workflow subscribed to refund.status.received', id: null };

    if (run.status === 'succeeded') {
      record.status = run.output?.refundStatus ?? record.status;
      record.riskScore = run.output?.riskScore ?? record.riskScore;
      record.priority = run.output?.priority ?? record.priority;
      appendTimeline(record, {
        type: 'workflow-completed',
        detail: `Workflow ${run.workflow} → ${record.status} (risk ${record.riskScore})`,
        workflowRunId: run.id,
        emittedEvent: run.output?.emittedEvent ?? null
      });
    } else {
      appendTimeline(record, {
        type: 'workflow-failed',
        detail: run.error ?? 'workflow failed',
        workflowRunId: run.id
      });
    }

    const intelligence = scoreRefundIntelligence({
      refundStatus: record.status,
      hasTranscript: input.hasTranscript === true,
      sbtpgEnrolled: input.sbtpgEnrolled === true,
      posPaid: input.posPaid === true,
      daysSinceFiling: Number(input.daysSinceFiling) || 0,
      paymentGateBlocked: input.paymentGateBlocked !== false
    });
    record.intelligence = {
      ...intelligence,
      engine: refundIntelligenceEngine.name,
      capabilities: refundIntelligenceEngine.capabilities
    };
    appendTimeline(record, {
      type: 'intelligence',
      detail: `Score ${intelligence.score}/100 (${intelligence.band}) — ${intelligence.recommendation}`
    });

    record.updatedAt = now();
    return { case: snapshot(record), event, pipeline: pipelineResult, workflowRun: summarizeRun(run) };
  }

  function snapshot(record) {
    return {
      ...record,
      timeline: [...record.timeline],
      company: PLATFORM_IDENTITY.company,
      application: PLATFORM_IDENTITY.application
    };
  }

  function summarizeRun(run) {
    return {
      id: run.id,
      workflow: run.workflow,
      status: run.status,
      error: run.error ?? null,
      refundStatus: run.output?.refundStatus ?? null,
      riskScore: run.output?.riskScore ?? null,
      priority: run.output?.priority ?? null,
      emittedEvent: run.output?.emittedEvent ?? null
    };
  }

  function getTimeline(caseId) {
    const record = getCase(caseId);
    if (!record) return null;
    return { caseId: record.id, timeline: [...record.timeline] };
  }

  function listEvents({ limit = 50 } = {}) {
    return events.slice(0, limit);
  }

  /**
   * Ingest a federal refund case (RefundCase + initial TimelineEvent).
   * Spec: POST /rtpsc/cases/ingest
   */
  async function ingestCase(input = {}, meta = {}) {
    const caseId = input.caseId ?? input.id;
    if (!caseId) throw new Error('caseId is required.');
    const result = await ingestEvent(
      {
        caseId,
        taxpayerRef: input.taxpayerRef,
        amount: input.amount,
        filingStage: input.filingStage ?? 'sent',
        source: input.source ?? 'api',
        hasTranscript: input.hasTranscript !== false
      },
      meta
    );
    const record = getCase(caseId);
    appendTimeline(record, {
      stage: 'ingested',
      type: 'ingested',
      label: 'Case ingested from approved source',
      detail: 'Case ingested from approved source',
      details: {
        amount: input.amount ?? null,
        filingStage: input.filingStage ?? 'sent',
        source: input.source ?? 'api'
      }
    });
    if (input.ledger) record.ledger = input.ledger;
    record.caseId = record.id;
    return {
      case: snapshot(record),
      event: result.event,
      pipeline: result.pipeline,
      workflowRun: result.workflowRun
    };
  }

  /**
   * Run the full federal refund path — link ledger + append ordered TimelineEvents.
   * Spec: POST /rtpsc/cases/{caseId}/run-full-path
   */
  async function runFullPath(caseId, options = {}) {
    const id = String(caseId);
    let record = getCase(id);
    if (!record && !options.trace && !options.ledgerRow) {
      throw new Error(`case_not_found: ${id}`);
    }

    let trace = options.trace ?? null;
    if (!trace && options.ledgerRow) {
      trace = buildFederalTraceTimeline(options.ledgerRow);
    }
    if (!trace && options.ledgerText) {
      const parsed = parseFullReportExport(options.ledgerText);
      const built = buildFederalTraces(parsed);
      trace =
        findFederalTrace(built.traces, {
          taxpayerRef: options.taxpayerRef ?? record?.taxpayerRef,
          returnId: options.returnId,
          lastFour: options.lastFour
        }) ?? built.traces[0] ?? null;
    }

    if (!record) {
      record = ensureCase(id, {
        taxpayerRef: trace?.taxpayerRef ?? options.taxpayerRef ?? 'unknown',
        filingStage: trace?.filingStage ?? 'sent',
        source: options.source ?? 'api',
        amount: trace?.amount ?? options.amount ?? null,
        ledger: trace?.ledger ?? null,
        latestStage: 'ingested'
      });
    }

    if (trace?.ledger) record.ledger = { ...(record.ledger ?? {}), ...trace.ledger };
    if (trace?.amount != null) record.amount = trace.amount;
    if (trace?.taxpayerRef) record.taxpayerRef = trace.taxpayerRef;
    if (trace?.filingStage) record.filingStage = trace.filingStage;

    const timeline = trace?.timeline ?? [];
    for (const evt of timeline) {
      // Skip duplicate stage labels already present
      const exists = record.timeline.some((t) => t.stage === evt.stage && t.label === evt.label);
      if (exists) continue;
      appendTimeline(record, {
        stage: evt.stage,
        type: evt.stage,
        label: evt.label,
        detail: evt.label,
        details: evt.details ?? {},
        phrase: evt.phrase ?? null
      });
    }

    // Drive pipeline/intelligence once at terminal stage
    const terminal = record.latestStage || 'ingested';
    const filingStage =
      terminal === 'closed' || terminal === 'funded'
        ? 'paid'
        : terminal === 'accepted'
          ? 'approved'
          : terminal === 'transmitted'
            ? 'sent'
            : record.filingStage;
    const intel = await ingestEvent(
      {
        caseId: id,
        taxpayerRef: record.taxpayerRef,
        amount: record.amount,
        filingStage,
        source: options.source ?? record.source ?? 'federal-refund-trace',
        hasTranscript: true,
        sbtpgEnrolled: Boolean(record.ledger?.bankProduct)
      },
      { source: metaSource(options), clientIdHint: options.clientIdHint }
    );

    record = getCase(id);
    return {
      case: snapshot(record),
      timeline: [...record.timeline],
      trace: trace
        ? { caseId: trace.caseId, latestStage: trace.latestStage, ledger: trace.ledger }
        : null,
      workflowRun: intel.workflowRun
    };
  }

  function metaSource(options = {}) {
    return options.source ?? 'federal-refund-trace';
  }

  /** Import an entire Full Report Export CSV into cases + full paths. */
  async function ingestFederalLedger(csvText, options = {}) {
    const parsed = parseFullReportExport(csvText);
    const built = buildFederalTraces(parsed);
    const imported = [];
    const limit = options.limit ?? built.traces.length;
    for (const trace of built.traces.slice(0, limit)) {
      const caseId = options.caseIdPrefix
        ? `${options.caseIdPrefix}${trace.caseId}`
        : trace.caseId;
      await ingestCase(
        {
          caseId,
          taxpayerRef: trace.taxpayerRef,
          amount: trace.amount,
          filingStage: trace.filingStage,
          source: options.source ?? 'api',
          ledger: trace.ledger
        },
        { source: 'federal-ledger-import', clientIdHint: options.clientIdHint }
      );
      const full = await runFullPath(caseId, {
        trace: { ...trace, caseId },
        source: options.source ?? 'api',
        clientIdHint: options.clientIdHint
      });
      imported.push({
        caseId,
        taxpayerRef: full.case.taxpayerRef,
        amount: full.case.amount,
        latestStage: full.case.latestStage,
        events: full.timeline.length
      });
    }
    return {
      count: imported.length,
      source: 'full-report-export',
      imported,
      module: '@rtp/federal-refund-trace'
    };
  }

  function catalog() {
    return {
      pipeline: refundStatusPipeline,
      engine: refundIntelligenceEngine,
      workflow: workflow.name,
      filingStages: FILING_STAGES,
      traceStages: TRACE_STAGES,
      channels: ['refund.status.received', 'refund.status.updated', 'refund.status.escalated'],
      ingestionPolicy: 'Approved event sources and Full Report Export ledger only; no scraping.',
      federalRefundTrace: '@rtp/federal-refund-trace'
    };
  }

  function listCasesMinimal(opts = {}) {
    return listCases(opts).map((record) => ({
      caseId: record.id,
      taxpayerRef: record.taxpayerRef,
      amount: record.amount,
      filingStage: record.filingStage,
      latestStage: record.latestStage ?? record.timeline[0]?.stage ?? 'ingested'
    }));
  }

  return {
    ingestEvent,
    ingestCase,
    runFullPath,
    ingestFederalLedger,
    getCase: (id) => {
      const record = getCase(id);
      return record ? snapshot(record) : null;
    },
    listCases: (opts) => listCases(opts).map(snapshot),
    listCasesMinimal,
    getTimeline,
    listEvents,
    catalog,
    ensureCase: (id, seed) => snapshot(ensureCase(id, seed)),
    _cases: cases,
    _events: events,
    _runner: runner,
    _triggers: triggers
  };
}

export { FILING_STAGES, TRACE_STAGES };
