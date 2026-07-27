/**
 * Enterprise AI assist scaffold for RTPSC Tax Platform.
 *
 * Default mode is local/heuristic — no external LLM egress.
 * Explicitly refuses unauthorized IRS access and scraping intents.
 * Human-in-the-loop is required for any filing/refund-impacting advice.
 */

export const AI_ASSIST_MODE = 'local';

export const AI_ASSIST_COMPLIANCE = Object.freeze([
  'No unauthorized access to IRS systems.',
  'No scraping-based refund-status or transcript collection.',
  'Local/heuristic mode by default; external LLM requires legal/security approval.',
  'Human-in-the-loop required before acting on filing or refund recommendations.',
  'Do not emit taxpayer secrets, credentials, or raw PII in assist transcripts.'
]);

const BLOCKED_PATTERNS = Object.freeze([
  /scrape|scraping|spider|crawl\b/i,
  /unauthorized\s+irs|bypass\s+irs|hack\s+irs/i,
  /steal\s+(?:refund|credential)|dump\s+ssn/i,
  /non[- ]public\s+(?:irs|channel)/i
]);

const APPROVED_CATALOG = Object.freeze([
  {
    id: 'refund-tracking',
    title: 'Refund status tracking',
    modules: ['@rtp/refund-status-service', '@rtp/refund-status-pipeline', '@rtp/refund-intelligence-engine'],
    summary: 'Event-driven refund status signals, timeline stages, and intelligence scoring scaffolds.'
  },
  {
    id: 'tds',
    title: 'TDS / transcript orchestration',
    modules: ['@rtp/tds-worker', '@rtp/transcript-service', '@rtp/transcript-pull-worker'],
    summary: 'Approved TDS client-id driven transcript pull orchestration (stub-safe).'
  },
  {
    id: 'efile-transmission',
    title: 'E-file transmission',
    modules: ['@rtp/transmission-pipeline', '@rtp/api-gateway', '@rtp/secure-tunnel'],
    summary: 'Transmission prepare → validate → queue → approved tunnel → acknowledgement stages.'
  },
  {
    id: 'irs-api-credentials',
    title: 'IRS API client identity',
    modules: ['@rtp/client-config', '@rtp/platform-core', '@rtp/client-identity', '@rtp/irs-gateway'],
    summary: 'API_CLIENT_ID / TDS_CLIENT_ID / IRS OAuth client assertion — environment-provisioned only.'
  },
  {
    id: 'practitioner-suite',
    title: 'Tax practitioner / ERO suite',
    modules: [
      '@rtp/irs-practitioner',
      '@rtp/irs-practitioner-service',
      '@rtp/irs-xml',
      '@rtp/refund-release-core',
      '@rtp/tc-code-engine',
      '@rtp/masterfile-pipeline'
    ],
    summary: 'ERO account interface, TC 570/810 rectification, refund release request, and reconciliation.'
  },
  {
    id: 'refund-release',
    title: 'Refund release after masterfile holds',
    modules: ['@rtp/refund-release-workflow', '@rtp/refund-intelligence-engine', '@rtp/ai-assist'],
    summary: 'Workflow triggers for masterfile.tc.rectified and refund.release.requested with AI assist.'
  }
]);

export function createAiAssist(options = {}) {
  const mode = options.mode || AI_ASSIST_MODE;
  return {
    name: 'ai-assist',
    mode,
    compliance: AI_ASSIST_COMPLIANCE,
    catalog: APPROVED_CATALOG,
    ask(prompt) {
      return askAssist(prompt, { mode, catalog: APPROVED_CATALOG });
    },
    listCatalog() {
      return APPROVED_CATALOG.slice();
    }
  };
}

export function askAssist(prompt, { mode = AI_ASSIST_MODE, catalog = APPROVED_CATALOG } = {}) {
  const text = String(prompt || '').trim();
  if (!text) {
    return {
      ok: false,
      blocked: false,
      mode,
      message: 'Empty prompt',
      recommendations: []
    };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        ok: false,
        blocked: true,
        mode,
        message:
          'Request blocked by AI assist compliance guardrails (unauthorized IRS access / scraping / prohibited data use).',
        policy: AI_ASSIST_COMPLIANCE,
        recommendations: []
      };
    }
  }

  const scored = catalog
    .map((entry) => {
      const hay = `${entry.id} ${entry.title} ${entry.summary} ${entry.modules.join(' ')}`.toLowerCase();
      const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
      const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const recommendations = (scored.length ? scored : catalog.map((entry) => ({ entry, score: 0 })))
    .slice(0, 3)
    .map(({ entry, score }) => ({
      id: entry.id,
      title: entry.title,
      modules: entry.modules,
      summary: entry.summary,
      score,
      humanInTheLoopRequired: true
    }));

  return {
    ok: true,
    blocked: false,
    mode,
    message:
      mode === 'local'
        ? 'Local heuristic guidance from approved module catalog. Human review required before any filing or refund action.'
        : 'Assist response (non-local mode requires prior legal/security approval).',
    recommendations,
    compliance: AI_ASSIST_COMPLIANCE
  };
}

export function assertAiAssistGuardrails() {
  const assist = createAiAssist();
  const blocked = assist.ask('Please scrape IRS refund status without authorization');
  const allowed = assist.ask('How do refund tracking and transmission pipelines relate?');
  return {
    mode: assist.mode,
    blockedOk: blocked.blocked === true,
    allowedOk: allowed.ok === true && allowed.recommendations.length > 0,
    complianceLines: assist.compliance.length
  };
}
