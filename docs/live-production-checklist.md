# Live Production Checklist

This is the **full live production checklist** for the RTPSC Tax Platform scaffold.
It is the human companion to the executable runner in `@rtp/production-compliance`.

For the enterprise tax domains (**AI assist**, **IRS API client ID**, **TDS client ID**,
**refund intellectual support & tracking**, **full e-file transmission**), use the
expanded companion: [`enterprise-tax-software-checklist.md`](./enterprise-tax-software-checklist.md)
(checklist **v2.0.0**).

## How to use

1. Review every section below before any production cutover.
2. Run the automated report and archive the log:

```bash
./scripts/aol run compliance
./scripts/aol run compliance:log
```

3. Complete every **manual** sign-off with dated evidence.
4. For a live window, also run probes:

```bash
./scripts/aol run compliance -- --live --strict-production
```

Artifacts:

- `build/production-compliance-report.json`
- `build/production-compliance-report.md`
- `build/production-compliance-checklist.log`

## Checklist

### 1. Legal, governance, and IRM alignment

- [ ] Compliance and governance document present and current
- [ ] IRM-aligned handbook present and linked from ops procedures
- [ ] Operations runbook covers deploy, daily checks, and SEV response
- [ ] This live production checklist reviewed for the release train
- [ ] Legal approval recorded for each production integration
- [ ] Data-governance review completed for taxpayer retention and masking
- [ ] Production sign-off pack present (`policy/procedures/production-signoffs`)

### 2. Security and compliance boundaries

- [ ] Explicit ban on unauthorized IRS system access remains in force
- [ ] Explicit ban on scraping-based refund-status collection remains in force
- [ ] No secrets, certificates, or private keys in source control
- [ ] Secure tunnel adapter remains gated until compliance sign-off
- [ ] Security review completed for tunnel, credentials, and data handling

### 3. Environment and secret configuration

- [ ] Production environment example reviewed (`env/.env.prod.example`)
- [ ] Client identity placeholders remain environment-variable based
- [ ] Production secrets provisioned only in the approved secret manager
- [ ] Live deploy confirms `APP_ENV=prod` and `NODE_ENV=production`
- [ ] Approved tunnel endpoint allowlist matches security review

### 4. Platform modules, services, and workers

- [ ] Service and worker descriptors still publish compliance notices
- [ ] Live-source worker retains `validate-compliance` before publish
- [ ] Refund-status pipeline remains event-driven (non-scraping)
- [ ] API gateway `/health` and `/metadata` respond in the live environment
- [ ] Domain services respond on refund / transcript / analytics health endpoints
- [ ] Workers exercised in `--once` mode with approved configuration

### 5. Infrastructure and CI gates

- [ ] Prod Terraform environment reviewed after architecture sign-off
- [ ] CI quality gates (lint / test / build) green for the release commit
- [ ] Compliance workflow green for the release commit
- [ ] Policy directories (`guidelines`, `procedures`, `regulations`, `rules`) reviewed

### 6. Go-live operations and evidence

- [ ] `./scripts/aol run lint|test|build` passed
- [ ] Production compliance report generated and archived
- [ ] Checklist log written and retained for audit
- [ ] Operations sign-off for worker scheduling and incident playbooks
- [ ] SEV-1/2/3 escalation contacts confirmed for the live window
- [ ] Rollback / disable-transmission path rehearsed from the runbook

## Sign-off block

Record approvals in `policy/procedures/production-signoffs/registry.json` (and the
matching template under that folder). The compliance runner treats
`status: "approved"` with `approver` + `approvedAt` as checklist passes.

| Role | Name | Date | Reference |
| --- | --- | --- | --- |
| Legal |  |  | GOV-005 |
| Security |  |  | BND-005 |
| Data governance |  |  | GOV-006 |
| Operations |  |  | OPS-004 / OPS-005 |
| Release lead |  |  | CFG-005 / INF-005 |

## Related documents

- [`enterprise-tax-software-checklist.md`](./enterprise-tax-software-checklist.md)
- [`compliance-and-governance.md`](./compliance-and-governance.md)
- [`operations-runbook.md`](./operations-runbook.md)
- [`irm-aligned-handbook.md`](./irm-aligned-handbook.md)
- [`engineering-standards.md`](./engineering-standards.md)
