/**
 * @rtp/pro-superiority — Competitive scorecard vs TaxSlayer Pro–class software.
 * Positions Ross Tax Pro Software Co capabilities that outpace legacy Pro suites.
 */

import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';
import { AI_HARD_PROHIBITIONS } from '../../ero-governance/src/index.mjs';
import { describeTaxPrep } from '../../tax-prep/src/index.mjs';

/** Baseline competitor class used for operator scorecards (not an affiliation). */
export const COMPETITOR_CLASS = Object.freeze({
  id: 'taxslayer-pro-class',
  label: 'TaxSlayer Pro–class desktop tax software',
  notice:
    'Comparison is against the common Pro-suite capability pattern (interview, forms, e-file, bank products). Not affiliated with TaxSlayer.'
});

/**
 * Capability rows: posture is ahead | parity | building relative to Pro-class.
 * scoreWeight influences the overall superiority index (0–100).
 */
export const CAPABILITY_MATRIX = Object.freeze([
  {
    id: 'interview-diagnostics',
    area: 'Tax prep interview & diagnostics',
    competitor: 'Guided interview + diagnostic strip on desktop Pro',
    rtpsc: 'Interview modules + Form 8867 diligence + ROI-linked diagnostics on Pro Desk',
    posture: 'ahead',
    scoreWeight: 12,
    evidence: ['@rtp/tax-prep', 'services/pro-desk-service']
  },
  {
    id: 'refund-intelligence',
    area: 'Refund optimization intelligence',
    competitor: 'Basic credit estimators; limited scenario compare',
    rtpsc: 'Deterministic ROI engine with credit scan, HOH lever, audit-grade explanation',
    posture: 'ahead',
    scoreWeight: 14,
    evidence: ['engines/refund-optimization-engine', 'engines/refund-intelligence-engine']
  },
  {
    id: 'unified-ops',
    area: 'CRM · POS · invoicing',
    competitor: 'Tax prep siloed from register / CRM / parish tax invoicing',
    rtpsc: 'Integrated POS+CRM desk with invoice-core tax math and receipt PDFs',
    posture: 'ahead',
    scoreWeight: 12,
    evidence: ['services/pos-crm-service', 'packages/invoice-core', 'packages/crm-core']
  },
  {
    id: 'bank-products-gate',
    area: 'Bank products / refund advance',
    competitor: 'Embedded bank products; funding paths vary by season',
    rtpsc: 'SBTPG enrollment with fail-safe payment gate (blocked until prod + secrets + consent)',
    posture: 'ahead',
    scoreWeight: 10,
    evidence: ['packages/bank-products', 'services/enrollment-service']
  },
  {
    id: 'ai-governance',
    area: 'AI workforce governance',
    competitor: 'Optional AI helpers without hard transmit prohibitions',
    rtpsc: `AI personas under RTP-AI-001 — hard bans: ${AI_HARD_PROHIBITIONS.slice(0, 3).join(', ')}, …`,
    posture: 'ahead',
    scoreWeight: 12,
    evidence: ['packages/ero-governance', 'services/ai-workforce-hub']
  },
  {
    id: 'efile-killswitch',
    area: 'E-file environment protection',
    competitor: 'Desktop transmit with credential prompts',
    rtpsc: 'Platform kill-switch + stub tunnel holds transmission until compliance sign-off',
    posture: 'ahead',
    scoreWeight: 10,
    evidence: ['packages/platform-core', 'packages/secure-tunnel', 'workflows/transmission-workflow']
  },
  {
    id: 'refund-ops',
    area: 'Refund status operations',
    competitor: 'Client-facing status tools; limited ERO timeline intelligence',
    rtpsc: 'Full refund center with case timeline, intel scoring, approved-event ingest',
    posture: 'ahead',
    scoreWeight: 10,
    evidence: ['services/refund-status-service', 'packages/refund-core']
  },
  {
    id: 'compliance-checklists',
    area: 'Executable compliance',
    competitor: 'Manual seasonal checklists outside the product',
    rtpsc: 'Executable production compliance + enterprise tax software checklist gates',
    posture: 'ahead',
    scoreWeight: 8,
    evidence: ['packages/production-compliance', 'docs/enterprise-tax-software-checklist.md']
  },
  {
    id: 'operator-plane',
    area: 'Operator control plane',
    competitor: 'Desktop app + vendor portal',
    rtpsc: 'RunTime AI Assist control plane (auth, RBAC, inventory, SEO) on :8787',
    posture: 'ahead',
    scoreWeight: 6,
    evidence: ['ross_ai/', 'docs/ross-ai-runtime-platform.md']
  },
  {
    id: 'live-mef-calc',
    area: 'Live MeF forms calculation',
    competitor: 'Mature IRS schema calc / e-file pack',
    rtpsc: 'Form catalog + diagnostics scaffold; live MeF calc gated behind tunnel & legal sign-off',
    posture: 'building',
    scoreWeight: 6,
    evidence: ['packages/tax-prep', 'forms/', 'packages/secure-tunnel']
  }
]);

const POSTURE_SCORE = Object.freeze({
  ahead: 1,
  parity: 0.72,
  building: 0.42
});

export function listDifferentiators() {
  return CAPABILITY_MATRIX.filter((row) => row.posture === 'ahead').map((row) => ({
    id: row.id,
    area: row.area,
    rtpsc: row.rtpsc,
    evidence: [...row.evidence]
  }));
}

export function buildSuperiorityScorecard(options = {}) {
  const rows = CAPABILITY_MATRIX.map((row) => {
    const factor = POSTURE_SCORE[row.posture] ?? 0.5;
    const points = Math.round(row.scoreWeight * factor * 10) / 10;
    return {
      ...row,
      evidence: [...row.evidence],
      points,
      maxPoints: row.scoreWeight
    };
  });

  const earned = rows.reduce((sum, r) => sum + r.points, 0);
  const max = rows.reduce((sum, r) => sum + r.maxPoints, 0);
  const index = max > 0 ? Math.round((earned / max) * 1000) / 10 : 0;
  const aheadCount = rows.filter((r) => r.posture === 'ahead').length;
  const buildingCount = rows.filter((r) => r.posture === 'building').length;

  let verdict = 'competitive';
  if (index >= 78 && aheadCount >= 7) verdict = 'superior_scaffold';
  if (index >= 90 && buildingCount === 0) verdict = 'superior_production';

  return {
    brand: PLATFORM_IDENTITY.company,
    application: PLATFORM_IDENTITY.application,
    competitor: COMPETITOR_CLASS,
    index,
    verdict,
    summary: {
      ahead: aheadCount,
      parity: rows.filter((r) => r.posture === 'parity').length,
      building: buildingCount,
      earnedPoints: Math.round(earned * 10) / 10,
      maxPoints: max
    },
    rows,
    headline:
      verdict === 'superior_scaffold'
        ? 'RTPSC Pro Desk outpaces TaxSlayer Pro–class on ops, ROI, AI governance, and fail-safe e-file — with live MeF calc still gated.'
        : 'RTPSC is closing the Pro gap with integrated operations and governed AI.',
    taxPrep: describeTaxPrep(),
    generatedAt: new Date().toISOString(),
    options
  };
}

export function describeProSuperiority() {
  const card = buildSuperiorityScorecard();
  return {
    name: '@rtp/pro-superiority',
    version: '0.1.0',
    role: 'Competitive superiority scorecard vs TaxSlayer Pro–class software',
    company: PLATFORM_IDENTITY.company,
    competitor: COMPETITOR_CLASS.label,
    index: card.index,
    verdict: card.verdict,
    differentiators: listDifferentiators().map((d) => d.id),
    commands: ['./rtpsc pro scorecard', './rtpsc start pro-desk', 'http://localhost:3007']
  };
}
