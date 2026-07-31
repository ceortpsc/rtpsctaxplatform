/**
 * Enterprise-grade tax software production checklist for the RTPSC Tax Platform.
 * Covers governance, IRS API / TDS client IDs, AI assist, refund intelligence &
 * tracking, and full e-file transmission systems — plus scaffold platform gates.
 *
 * Items marked mode=automated are executed by the compliance runner.
 * Items marked mode=manual require documented human sign-off before live prod.
 * Items marked mode=live require running services (--live).
 */

export const CHECKLIST_VERSION = '2.0.0';

export const CHECKLIST_SECTIONS = Object.freeze([
  {
    id: 'governance',
    title: 'Legal, governance, and IRM alignment',
    items: [
      {
        id: 'GOV-001',
        title: 'Compliance and governance document present',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'docs/compliance-and-governance.md'
      },
      {
        id: 'GOV-002',
        title: 'IRM-aligned handbook present',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'docs/irm-aligned-handbook.md'
      },
      {
        id: 'GOV-003',
        title: 'Operations runbook present with deployment and incident steps',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'docs/operations-runbook.md'
      },
      {
        id: 'GOV-004',
        title: 'Live production checklist document present',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'docs/live-production-checklist.md'
      },
      {
        id: 'GOV-007',
        title: 'Enterprise tax software checklist document present',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'docs/enterprise-tax-software-checklist.md'
      },
      {
        id: 'GOV-005',
        title: 'Legal approval recorded for each production integration',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Signed legal approval ticket / memo'
      },
      {
        id: 'GOV-006',
        title: 'Data-governance review for taxpayer retention and masking',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Data governance review record'
      },
      {
        id: 'GOV-008',
        title: 'Enterprise AI assist policy approved (disclosure, retention, no unauthorized IRS use)',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'AI assist policy + legal/security sign-off'
      },
      {
        id: 'GOV-009',
        title: 'Production sign-off pack and registry present',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'policy/procedures/production-signoffs/registry.json'
      }
    ]
  },
  {
    id: 'boundaries',
    title: 'Security and compliance boundaries',
    items: [
      {
        id: 'BND-001',
        title: 'Explicit ban on unauthorized IRS system access',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'docs + README boundary language'
      },
      {
        id: 'BND-002',
        title: 'Explicit ban on scraping-based refund-status collection',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'docs + README + descriptors'
      },
      {
        id: 'BND-003',
        title: 'No secrets, certificates, or private keys committed',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'Source scan of tracked files'
      },
      {
        id: 'BND-004',
        title: 'Secure tunnel remains stub until compliance sign-off',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/secure-tunnel status=stub'
      },
      {
        id: 'BND-005',
        title: 'Security review completed for tunnel, credentials, and data handling',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Security review record'
      },
      {
        id: 'BND-006',
        title: 'AI assist explicitly forbidden from unauthorized IRS access or scraping',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/ai-assist compliance guardrails'
      },
      {
        id: 'SEC-001',
        title: 'Security-core package exports tokens, encryption, headers, and rate limits',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/security-core'
      },
      {
        id: 'SEC-002',
        title: 'Secrets-config evaluates redacted readiness without exposing values',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/secrets-config'
      },
      {
        id: 'SEC-003',
        title: 'Secure tunnel gate validates HTTPS endpoint and keeps adapter stub',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/secure-tunnel evaluateTunnelGate'
      },
      {
        id: 'SEC-004',
        title: 'Security status service and scanner worker are scaffolded',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'services/security-status-service + workers/security-scanner-worker'
      },
      {
        id: 'SEC-005',
        title: 'API gateway mints HMAC bearer tokens when SESSION_SECRET is set',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'services/api-gateway + security-core mintAccessToken'
      }
    ]
  },
  {
    id: 'irs_api_credentials',
    title: 'IRS API client ID and credential readiness',
    items: [
      {
        id: 'IRS-001',
        title: 'API_CLIENT_ID / API_CLIENT_SECRET placeholders defined in client-config',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/client-config'
      },
      {
        id: 'IRS-002',
        title: 'Production env example documents IRS API client identity fields',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'env/.env.prod.example'
      },
      {
        id: 'IRS-003',
        title: 'Platform-core loads API_CLIENT_ID from environment (never hard-coded)',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/platform-core runtime config'
      },
      {
        id: 'IRS-004',
        title: 'API gateway metadata declares authorized credential placeholders only',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'services/api-gateway descriptor'
      },
      {
        id: 'IRS-005',
        title: 'IRS API client enrollment / e-Services (or successor) approval recorded',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'IRS enrollment / client-id issuance record'
      },
      {
        id: 'IRS-006',
        title: 'Sandbox IRS API client ID validated before production client ID cutover',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Sandbox validation report'
      },
      {
        id: 'IRS-007',
        title: 'Production API_CLIENT_ID rotated and stored only in approved secret manager',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Secret manager inventory + rotation log'
      },
      {
        id: 'IRS-008',
        title: 'OAuth/token (or approved auth) flow design reviewed for IRS API client',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Auth design review'
      }
    ]
  },
  {
    id: 'tds_credentials',
    title: 'TDS client ID and credential readiness',
    items: [
      {
        id: 'TDS-001',
        title: 'TDS_CLIENT_ID / TDS_CLIENT_SECRET placeholders defined in client-config',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/client-config'
      },
      {
        id: 'TDS-002',
        title: 'Production env example documents TDS client identity fields',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'env/.env.prod.example'
      },
      {
        id: 'TDS-003',
        title: 'TDS worker scaffold present with approved-config load step',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'workers/tds-worker'
      },
      {
        id: 'TDS-004',
        title: 'Transcript service / pull worker scaffolds present for TDS orchestration',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'services/transcript-service + workers/transcript-pull-worker'
      },
      {
        id: 'TDS-005',
        title: 'TDS client enrollment and transmitter agreements approved',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'TDS enrollment / agreement package'
      },
      {
        id: 'TDS-006',
        title: 'Production TDS_CLIENT_ID provisioned in secret manager (not in VCS)',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Secret manager inventory'
      },
      {
        id: 'TDS-007',
        title: 'TDS job scheduling, retry, and escalation SLAs documented',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Operations runbook TDS section'
      },
      {
        id: 'TDS-008',
        title: 'TDS sandbox pull validated before production enablement',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Sandbox TDS validation report'
      }
    ]
  },
  {
    id: 'ai_assist',
    title: 'Enterprise-grade AI assist',
    items: [
      {
        id: 'AIA-001',
        title: 'AI assist package present with compliance guardrails',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/ai-assist'
      },
      {
        id: 'AIA-002',
        title: 'AI assist defaults to local/heuristic mode (no external LLM without approval)',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/ai-assist mode=local'
      },
      {
        id: 'AIA-003',
        title: 'AI assist refuses unauthorized IRS access / scraping intents',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/ai-assist policy checks'
      },
      {
        id: 'AIA-004',
        title: 'AI assist surfaces refund / transmission / TDS module guidance only from approved catalogs',
        mode: 'automated',
        severity: 'warning',
        evidence: 'packages/ai-assist catalog grounding'
      },
      {
        id: 'AIA-005',
        title: 'Human-in-the-loop required for AI recommendations affecting filings or refunds',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'AI assist operating procedure'
      },
      {
        id: 'AIA-006',
        title: 'External LLM / model vendor DPIA and BAA (if applicable) completed',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'DPIA / vendor risk package'
      },
      {
        id: 'AIA-007',
        title: 'Taxpayer PII redaction rules enforced before any model prompt egress',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'PII redaction test evidence'
      },
      {
        id: 'AIA-008',
        title: 'AI assist audit log retained for recommendations affecting compliance decisions',
        mode: 'manual',
        severity: 'warning',
        evidence: 'Audit log retention config'
      }
    ]
  },
  {
    id: 'refund_intelligence',
    title: 'Refund intellectual support and tracking services',
    items: [
      {
        id: 'RFD-001',
        title: 'Refund status service scaffold present',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'services/refund-status-service'
      },
      {
        id: 'RFD-002',
        title: 'Refund status pipeline is event-driven (non-scraping)',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'pipelines/refund-status-pipeline'
      },
      {
        id: 'RFD-003',
        title: 'Refund intelligence engine capabilities declared (correlation, risk, priority)',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'engines/refund-intelligence-engine'
      },
      {
        id: 'RFD-004',
        title: 'Analytics service binds refund intelligence + TC code engines',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'services/analytics-service'
      },
      {
        id: 'RFD-005',
        title: 'Refund tracking timeline / case workflow design approved',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Refund tracking design + product sign-off'
      },
      {
        id: 'RFD-006',
        title: 'Refund status data sources limited to authorized IRS/event channels',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Authorized source inventory'
      },
      {
        id: 'RFD-007',
        title: 'Refund intelligence scoring validated against sample authorized events',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Validation dataset report'
      },
      {
        id: 'RFD-008',
        title: 'Operator tracking UI / API contracts reviewed for PII minimization',
        mode: 'manual',
        severity: 'warning',
        evidence: 'API/UI privacy review'
      },
      {
        id: 'RFD-009',
        title: 'Live refund-status and analytics /health probes respond',
        mode: 'live',
        severity: 'blocker',
        evidence: 'HTTP probes 3001 + 3003'
      }
    ]
  },
  {
    id: 'efile_transmission',
    title: 'Full e-file transmission systems',
    items: [
      {
        id: 'EFL-001',
        title: 'Transmission pipeline stages cover prepare → validate → queue → tunnel → ack',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'pipelines/transmission-pipeline'
      },
      {
        id: 'EFL-002',
        title: 'API gateway declares transmission flows / guardrails metadata',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'services/api-gateway'
      },
      {
        id: 'EFL-003',
        title: 'Secure tunnel adapter scaffold present and compliance-gated',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/secure-tunnel'
      },
      {
        id: 'EFL-004',
        title: 'Masterfile pipeline scaffold present for intake/normalization',
        mode: 'automated',
        severity: 'warning',
        evidence: 'pipelines/masterfile-pipeline'
      },
      {
        id: 'EFL-005',
        title: 'Forms and letters template directories scaffolded for e-file packaging support',
        mode: 'automated',
        severity: 'warning',
        evidence: 'forms/ + letters/'
      },
      {
        id: 'EFL-006',
        title: 'MeF / e-file transmitter credentials and EFIN/ETIN (or successor) recorded',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Transmitter credential inventory'
      },
      {
        id: 'EFL-007',
        title: 'Schema validation suite for transmission payloads approved',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Schema test suite + sign-off'
      },
      {
        id: 'EFL-008',
        title: 'Acknowledgement / rejection processing and retry policy approved',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Ack/reject runbook'
      },
      {
        id: 'EFL-009',
        title: 'Production transmission kill-switch / disable path rehearsed',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'SEV-1 disable-transmission drill record'
      },
      {
        id: 'EFL-010',
        title: 'End-to-end sandbox e-file transmission validated before go-live',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Sandbox e-file validation report'
      },
      {
        id: 'EFL-011',
        title: 'Live API gateway /health responds for transmission entrypoint',
        mode: 'live',
        severity: 'blocker',
        evidence: 'HTTP probe :3000/health'
      }
    ]
  },
  {
    id: 'configuration',
    title: 'Environment and secret configuration',
    items: [
      {
        id: 'CFG-001',
        title: 'Production environment example present',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'env/.env.prod.example'
      },
      {
        id: 'CFG-002',
        title: 'Client identity placeholders are environment-variable based',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'packages/client-config'
      },
      {
        id: 'CFG-003',
        title: 'Prod env example uses secret-store placeholders (not live secrets)',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'env/.env.prod.example'
      },
      {
        id: 'CFG-004',
        title: 'Production secrets provisioned in approved secret manager',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Secret manager inventory'
      },
      {
        id: 'CFG-005',
        title: 'APP_ENV=prod and NODE_ENV=production confirmed for live deploy',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Deploy config / runtime metadata'
      }
    ]
  },
  {
    id: 'platform',
    title: 'Platform modules, services, and workers',
    items: [
      {
        id: 'PLT-001',
        title: 'Service descriptors carry compliance notices',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'platform-core createServiceDescriptor'
      },
      {
        id: 'PLT-002',
        title: 'Worker descriptors carry compliance notices',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'platform-core createWorkerDescriptor'
      },
      {
        id: 'PLT-003',
        title: 'Live-source worker validates compliance before publish',
        mode: 'automated',
        severity: 'warning',
        evidence: 'workers/live-source-fetcher steps'
      },
      {
        id: 'PLT-004',
        title: 'Refund-status pipeline remains event-driven (non-scraping)',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'pipelines/refund-status-pipeline'
      },
      {
        id: 'PLT-005',
        title: 'API gateway /health and /metadata respond in live environment',
        mode: 'live',
        severity: 'blocker',
        evidence: 'HTTP probes'
      },
      {
        id: 'PLT-006',
        title: 'Domain services /health respond (refund, transcript, analytics)',
        mode: 'live',
        severity: 'blocker',
        evidence: 'HTTP probes on 3001-3003'
      }
    ]
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure and CI gates',
    items: [
      {
        id: 'INF-001',
        title: 'Prod Terraform environment folder present',
        mode: 'automated',
        severity: 'warning',
        evidence: 'infra/terraform/env/prod'
      },
      {
        id: 'INF-002',
        title: 'CI quality gates workflow present (lint/test/build)',
        mode: 'automated',
        severity: 'blocker',
        evidence: '.github/workflows/ci.yml'
      },
      {
        id: 'INF-003',
        title: 'Compliance scaffold workflow present',
        mode: 'automated',
        severity: 'blocker',
        evidence: '.github/workflows/compliance.yml'
      },
      {
        id: 'INF-004',
        title: 'Policy artifact directories scaffolded',
        mode: 'automated',
        severity: 'warning',
        evidence: 'policy/{guidelines,procedures,regulations,rules}'
      },
      {
        id: 'INF-005',
        title: 'Terraform prod placeholders populated after architecture sign-off',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'infra/terraform/env/prod values'
      }
    ]
  },
  {
    id: 'operations',
    title: 'Go-live operations and evidence',
    items: [
      {
        id: 'OPS-001',
        title: 'Quality gates pass (lint, test, build)',
        mode: 'automated',
        severity: 'blocker',
        evidence: './scripts/aol run lint|test|build'
      },
      {
        id: 'OPS-002',
        title: 'Production compliance report generated and archived',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'build/production-compliance-report.json'
      },
      {
        id: 'OPS-003',
        title: 'Checklist log written for audit trail',
        mode: 'automated',
        severity: 'blocker',
        evidence: 'build/production-compliance-checklist.log'
      },
      {
        id: 'OPS-004',
        title: 'Operations sign-off for worker scheduling and incident playbooks',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'Operations sign-off record'
      },
      {
        id: 'OPS-005',
        title: 'SEV-1/2/3 escalation contacts confirmed for live window',
        mode: 'manual',
        severity: 'warning',
        evidence: 'On-call roster'
      },
      {
        id: 'OPS-006',
        title: 'Enterprise tax checklist sign-offs complete (IRS, TDS, AI, refund, e-file)',
        mode: 'manual',
        severity: 'blocker',
        evidence: 'docs/enterprise-tax-software-checklist.md sign-off block'
      }
    ]
  }
]);

export function listChecklistItems() {
  return CHECKLIST_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      sectionId: section.id,
      sectionTitle: section.title
    }))
  );
}

export function checklistSummary() {
  const items = listChecklistItems();
  const byMode = { automated: 0, manual: 0, live: 0 };
  for (const item of items) {
    byMode[item.mode] = (byMode[item.mode] || 0) + 1;
  }
  const bySection = Object.fromEntries(
    CHECKLIST_SECTIONS.map((section) => [section.id, section.items.length])
  );
  return {
    version: CHECKLIST_VERSION,
    sections: CHECKLIST_SECTIONS.length,
    items: items.length,
    byMode,
    bySection
  };
}
