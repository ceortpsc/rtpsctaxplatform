/**
 * Full live production checklist for the RTPSC Tax Platform scaffold.
 * Items marked mode=automated are executed by the compliance runner.
 * Items marked mode=manual require documented human sign-off before live prod.
 */

export const CHECKLIST_VERSION = '1.0.0';

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
        id: 'GOV-007',
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
  return {
    version: CHECKLIST_VERSION,
    sections: CHECKLIST_SECTIONS.length,
    items: items.length,
    byMode
  };
}
