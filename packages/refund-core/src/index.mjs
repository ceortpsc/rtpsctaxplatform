// Full refund operations core: cases, timeline, approved-event ingest,
// pipeline stage execution, and intelligence. No scraping / no live IRS.

import { createWorkflowRegistry, createWorkflowRunner, createTriggerManager } from '../../workflow-engine/src/index.mjs';
import { refundStatusWorkflow } from '../../../workflows/refund-status-workflow/src/index.mjs';
import { refundStatusPipeline } from '../../../pipelines/refund-status-pipeline/src/index.mjs';
import { refundIntelligenceEngine } from '../../../engines/refund-intelligence-engine/src/index.mjs';
import { scoreRefundIntelligence } from '../../ero-ops/src/index.mjs';
import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';

const FILING_STAGES = Object.freeze(['received', 'processing', 'approved', 'sent', 'paid', 'delay', 'review', 'offset']);

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
        taxpayerRef: seed.taxpayerRef ? String(seed.taxpayerRef) : 'unknown',
        status: 'status-unavailable',
        filingStage: seed.filingStage ?? 'received',
        priority: 'low',
        riskScore: 0,
        intelligence: null,
        timeline: [],
        source: seed.source ?? 'manual',
        amount: seed.amount != null ? Number(seed.amount) : null,
        createdAt,
        updatedAt: createdAt
      };
      cases.set(id, record);
    }
    return record;
  }

  function appendTimeline(record, entry) {
    record.timeline.unshift({
      id: nextId('tl'),
      at: now(),
      ...entry
    });
    if (record.timeline.length > 200) record.timeline.length = 200;
    record.updatedAt = now();
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

  function catalog() {
    return {
      pipeline: refundStatusPipeline,
      engine: refundIntelligenceEngine,
      workflow: workflow.name,
      filingStages: FILING_STAGES,
      channels: ['refund.status.received', 'refund.status.updated', 'refund.status.escalated'],
      ingestionPolicy: 'Approved event sources only; no scraping.'
    };
  }

  return {
    ingestEvent,
    getCase: (id) => {
      const record = getCase(id);
      return record ? snapshot(record) : null;
    },
    listCases: (opts) => listCases(opts).map(snapshot),
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

export { FILING_STAGES };
