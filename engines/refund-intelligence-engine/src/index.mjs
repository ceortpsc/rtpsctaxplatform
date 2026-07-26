import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';
import { runOptimizationWorkflow } from '../../refund-optimization-engine/src/index.mjs';

export const REFUND_STATES = Object.freeze([
  'FILED',
  'RECEIVED',
  'ACCEPTED',
  'IN_PROCESS',
  'APPROVED',
  'DISBURSED',
  'OFFSET',
  'HOLD'
]);

export const refundIntelligenceEngine = createEngineDescriptor({
  name: 'refund-intelligence-engine',
  capabilities: [
    'status-signal-correlation',
    'risk-flagging',
    'case-priority-suggestions',
    'lifecycle-state-machine',
    'canonical-status-resolver',
    'eta-prediction',
    'guard-level-detection',
    'roi-workflow-handoff'
  ],
  outputs: [
    'refund-intelligence-score',
    'refund-escalation-recommendation',
    'refundStatusCanonical',
    'refundEta',
    'guardLevel',
    'exceptionRoutes'
  ]
});

const STATE_RANK = Object.fromEntries(REFUND_STATES.map((state, index) => [state, index]));

export function resolveCanonicalStatus(signals = {}) {
  const candidates = [];
  if (signals.wmrStatus) candidates.push(normalizeStatus(signals.wmrStatus));
  if (signals.rfifStatus) candidates.push(normalizeStatus(signals.rfifStatus));
  if (signals.transcriptStatus) candidates.push(normalizeStatus(signals.transcriptStatus));
  if (signals.masterfileStatus) candidates.push(normalizeStatus(signals.masterfileStatus));
  if (candidates.length === 0) return { state: 'FILED', sources: [], confidence: 0.2 };

  const ranked = candidates
    .filter((state) => STATE_RANK[state] != null)
    .sort((a, b) => STATE_RANK[b] - STATE_RANK[a]);
  const state = ranked[0] || 'IN_PROCESS';
  return {
    state,
    sources: candidates,
    confidence: Math.min(0.95, 0.45 + candidates.length * 0.15)
  };
}

function normalizeStatus(value) {
  const raw = String(value || '').toUpperCase().replace(/\s+/g, '_');
  if (REFUND_STATES.includes(raw)) return raw;
  if (/APPROV/.test(raw)) return 'APPROVED';
  if (/DISBURS|SENT|SCHEDULED/.test(raw)) return 'DISBURSED';
  if (/OFFSET|TOP|LEVY/.test(raw)) return 'OFFSET';
  if (/HOLD|REVIEW|FREEZE/.test(raw)) return 'HOLD';
  if (/ACCEPT/.test(raw)) return 'ACCEPTED';
  if (/RECEIV/.test(raw)) return 'RECEIVED';
  if (/PROCESS/.test(raw)) return 'IN_PROCESS';
  if (/FILE/.test(raw)) return 'FILED';
  return 'IN_PROCESS';
}

export function detectGuardLevel(signals = {}) {
  let level = 'LOW';
  const reasons = [];
  if (signals.identityFlag || signals.idTheftIndicator) {
    level = 'HIGH';
    reasons.push('identity flag / ID theft indicator');
  }
  if (signals.manualReview) {
    level = 'HIGH';
    reasons.push('manual review status');
  }
  if ((signals.repeatedRejects || 0) >= 2) {
    level = level === 'HIGH' ? 'HIGH' : 'MEDIUM';
    reasons.push('repeated rejects');
  }
  if (signals.mismatchedIncome) {
    level = level === 'LOW' ? 'MEDIUM' : level;
    reasons.push('mismatched income signal');
  }
  return { level, reasons };
}

export function predictEta(canonical = {}, guard = {}) {
  const table = {
    FILED: [14, 28],
    RECEIVED: [10, 21],
    ACCEPTED: [7, 21],
    IN_PROCESS: [7, 21],
    APPROVED: [5, 7],
    DISBURSED: [0, 2],
    OFFSET: [14, 45],
    HOLD: [21, 60]
  };
  const [minDays, maxDays] = table[canonical.state] || [10, 30];
  const confidence = Math.max(0.2, (canonical.confidence || 0.5) - (guard.level === 'HIGH' ? 0.25 : 0));
  return { minDays, maxDays, confidence: Number(confidence.toFixed(2)), state: canonical.state };
}

export function buildRefundIntelligence(input = {}) {
  const canonical = resolveCanonicalStatus(input.signals || {});
  const guard = detectGuardLevel(input.signals || {});
  const eta = predictEta(canonical, guard);
  const roi = runOptimizationWorkflow(input.roi || input);
  const exceptionRoutes =
    guard.level === 'HIGH'
      ? ['create-office-task', 'notify-office', 'lock-sensitive-client-actions', 'require-human-review']
      : guard.level === 'MEDIUM'
        ? ['create-prep-correction-task', 'schedule-status-check']
        : ['continue-monitoring'];

  return {
    engine: refundIntelligenceEngine.name,
    lifecycle: REFUND_STATES,
    refundStatusCanonical: canonical,
    refundEta: eta,
    guardLevel: guard,
    exceptionRoutes,
    roiSummary: {
      baselineRefund: roi.baseline.refund,
      optimizedRefund: roi.optimized.refund,
      recommendationCount: roi.recommendations.length,
      riskFlags: roi.risks.length
    },
    score: Number((canonical.confidence * (guard.level === 'HIGH' ? 40 : guard.level === 'MEDIUM' ? 65 : 85)).toFixed(2)),
    outputs: refundIntelligenceEngine.outputs,
    compliance: refundIntelligenceEngine.compliance
  };
}
