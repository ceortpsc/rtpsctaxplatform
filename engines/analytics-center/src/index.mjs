import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const analyticsCenter = createEngineDescriptor({
  name: 'analytics-center',
  capabilities: [
    'metric-aggregation',
    'dashboard-feed-generation',
    'pipeline-throughput-reporting',
    'service-health-rollup',
    'refund-intelligence-feed'
  ],
  outputs: ['operations-dashboard', 'analytics-feed', 'throughput-report', 'health-rollup']
});

const DEFAULT_METRICS = Object.freeze({
  transmissionsQueued: 0,
  transmissionsCompleted: 0,
  refundCasesOpen: 0,
  refundCasesResolved: 0,
  transcriptPulls: 0,
  tdsPackets: 0,
  enrollmentsPending: 0,
  invoicesSettled: 0,
  posCheckouts: 0,
  aiPersonaTasks: 0
});

/**
 * Aggregate operational metrics into a deterministic dashboard feed.
 * Accepts partial counters and optional service health probes.
 */
export function aggregateMetrics(input = {}) {
  const metrics = { ...DEFAULT_METRICS };
  for (const key of Object.keys(DEFAULT_METRICS)) {
    if (input[key] != null && Number.isFinite(Number(input[key]))) {
      metrics[key] = Math.max(0, Number(input[key]));
    }
  }

  const services = Array.isArray(input.services) ? input.services : [];
  const healthy = services.filter((s) => s?.ok === true).length;
  const unhealthy = Math.max(0, services.length - healthy);

  const throughput = {
    transmissionRate:
      metrics.transmissionsQueued === 0
        ? metrics.transmissionsCompleted > 0
          ? 1
          : 0
        : Number((metrics.transmissionsCompleted / metrics.transmissionsQueued).toFixed(3)),
    refundResolutionRate:
      metrics.refundCasesOpen + metrics.refundCasesResolved === 0
        ? 0
        : Number(
            (
              metrics.refundCasesResolved /
              (metrics.refundCasesOpen + metrics.refundCasesResolved)
            ).toFixed(3)
          )
  };

  return {
    engine: analyticsCenter.name,
    generatedAt: new Date().toISOString(),
    metrics,
    throughput,
    health: {
      probed: services.length,
      healthy,
      unhealthy,
      status: unhealthy === 0 && services.length > 0 ? 'green' : services.length === 0 ? 'unknown' : 'amber'
    },
    outputs: analyticsCenter.outputs
  };
}

/**
 * Build the analytics feed consumed by analytics-service and the modules dashboard.
 */
export function buildAnalyticsFeed(input = {}) {
  const rollup = aggregateMetrics(input);
  const intelligence = input.intelligence || null;

  const cards = [
    {
      id: 'transmissions',
      title: 'Transmissions',
      value: rollup.metrics.transmissionsCompleted,
      subtitle: `${rollup.metrics.transmissionsQueued} queued`,
      tone: 'navy'
    },
    {
      id: 'refunds',
      title: 'Refund cases',
      value: rollup.metrics.refundCasesOpen,
      subtitle: `${rollup.metrics.refundCasesResolved} resolved`,
      tone: 'gold'
    },
    {
      id: 'transcripts',
      title: 'Transcript pulls',
      value: rollup.metrics.transcriptPulls,
      subtitle: `${rollup.metrics.tdsPackets} TDS packets`,
      tone: 'slate'
    },
    {
      id: 'commerce',
      title: 'Settled invoices',
      value: rollup.metrics.invoicesSettled,
      subtitle: `${rollup.metrics.posCheckouts} POS checkouts`,
      tone: 'green'
    }
  ];

  if (intelligence?.score != null) {
    cards.push({
      id: 'intelligence',
      title: 'Refund intelligence',
      value: intelligence.score,
      subtitle: intelligence.refundStatusCanonical?.state || 'FILED',
      tone: intelligence.guardLevel?.level === 'HIGH' ? 'danger' : 'info'
    });
  }

  return {
    engine: analyticsCenter.name,
    generatedAt: rollup.generatedAt,
    status: rollup.health.status,
    cards,
    rollup,
    intelligence: intelligence
      ? {
          score: intelligence.score,
          state: intelligence.refundStatusCanonical?.state,
          guard: intelligence.guardLevel?.level,
          eta: intelligence.refundEta
        }
      : null,
    compliance: analyticsCenter.compliance
  };
}

export function reportPipelineThroughput(stages = []) {
  const rows = (Array.isArray(stages) ? stages : []).map((stage, index) => {
    const processed = Number(stage.processed || 0);
    const failed = Number(stage.failed || 0);
    const total = processed + failed;
    return {
      order: index + 1,
      name: stage.name || `stage-${index + 1}`,
      processed,
      failed,
      successRate: total === 0 ? 0 : Number((processed / total).toFixed(3))
    };
  });

  return {
    engine: analyticsCenter.name,
    output: 'throughput-report',
    stages: rows,
    overallSuccessRate:
      rows.length === 0
        ? 0
        : Number((rows.reduce((sum, row) => sum + row.successRate, 0) / rows.length).toFixed(3))
  };
}
