# Enterprise Tax Software Checklist

**Full enterprise-grade checklist** for RTPSC Tax Platform covering:

1. AI assist  
2. IRS API client ID  
3. TDS client ID  
4. Refund intellectual support and tracking services  
5. Full e-file transmission systems  

Executable twin: `@rtp/production-compliance` checklist **v2.0.0**.

```bash
./scripts/aol run compliance:checklist
./scripts/aol run compliance -- --skip-gates
./scripts/aol run compliance -- --live --strict-production
```

---

## 1. Legal, governance, and IRM alignment

- [ ] Compliance and governance document present and current (`GOV-001`)
- [ ] IRM-aligned handbook present (`GOV-002`)
- [ ] Operations runbook covers deploy, daily checks, SEV response (`GOV-003`)
- [ ] Live production checklist reviewed (`GOV-004`)
- [ ] This enterprise tax software checklist reviewed (`GOV-007`)
- [ ] Legal approval recorded for each production integration (`GOV-005`)
- [ ] Data-governance review for taxpayer retention and masking (`GOV-006`)
- [ ] Enterprise AI assist policy approved — disclosure, retention, no unauthorized IRS use (`GOV-008`)

## 2. Security and compliance boundaries

- [ ] Ban on unauthorized IRS system access remains in force (`BND-001`)
- [ ] Ban on scraping-based refund-status collection remains in force (`BND-002`)
- [ ] No secrets, certificates, or private keys in source control (`BND-003`)
- [ ] Secure tunnel adapter remains gated until compliance sign-off (`BND-004`)
- [ ] Security review completed for tunnel, credentials, and data handling (`BND-005`)
- [ ] AI assist explicitly forbidden from unauthorized IRS access or scraping (`BND-006`)

## 3. IRS API client ID and credential readiness

- [ ] `API_CLIENT_ID` / `API_CLIENT_SECRET` placeholders in client-config (`IRS-001`)
- [ ] Production env example documents IRS API client identity fields (`IRS-002`)
- [ ] Platform-core loads `API_CLIENT_ID` from environment only (`IRS-003`)
- [ ] API gateway metadata declares authorized credential placeholders (`IRS-004`)
- [ ] IRS API client enrollment / e-Services (or successor) approval recorded (`IRS-005`)
- [ ] Sandbox IRS API client ID validated before production cutover (`IRS-006`)
- [ ] Production `API_CLIENT_ID` rotated and stored only in approved secret manager (`IRS-007`)
- [ ] OAuth/token (or approved auth) flow design reviewed (`IRS-008`)

**Production secret checklist (manual evidence):**

| Field | Secret manager path | Rotated | Owner |
| --- | --- | --- | --- |
| `API_CLIENT_ID` |  |  |  |
| `API_CLIENT_SECRET` |  |  |  |

## 4. TDS client ID and credential readiness

- [ ] `TDS_CLIENT_ID` / `TDS_CLIENT_SECRET` placeholders in client-config (`TDS-001`)
- [ ] Production env example documents TDS client identity fields (`TDS-002`)
- [ ] TDS worker scaffold present with approved-config load step (`TDS-003`)
- [ ] Transcript service + pull worker scaffolds present (`TDS-004`)
- [ ] TDS client enrollment and transmitter agreements approved (`TDS-005`)
- [ ] Production `TDS_CLIENT_ID` provisioned in secret manager (not VCS) (`TDS-006`)
- [ ] TDS job scheduling, retry, and escalation SLAs documented (`TDS-007`)
- [ ] TDS sandbox pull validated before production enablement (`TDS-008`)

**Production secret checklist (manual evidence):**

| Field | Secret manager path | Rotated | Owner |
| --- | --- | --- | --- |
| `TDS_CLIENT_ID` |  |  |  |
| `TDS_CLIENT_SECRET` |  |  |  |

## 5. Enterprise-grade AI assist

- [ ] AI assist package present with compliance guardrails (`AIA-001`)
- [ ] Defaults to local/heuristic mode — no external LLM without approval (`AIA-002`)
- [ ] Refuses unauthorized IRS access / scraping intents (`AIA-003`)
- [ ] Grounds guidance in approved module catalogs only (`AIA-004`)
- [ ] Human-in-the-loop required for filing or refund-impacting recommendations (`AIA-005`)
- [ ] External LLM / model vendor DPIA and BAA (if applicable) completed (`AIA-006`)
- [ ] Taxpayer PII redaction enforced before any model prompt egress (`AIA-007`)
- [ ] AI assist audit log retained for compliance-affecting recommendations (`AIA-008`)

```bash
node -e "import { createAiAssist } from './packages/ai-assist/src/index.mjs'; console.log(JSON.stringify(createAiAssist().ask('refund tracking'), null, 2))"
```

## 6. Refund intellectual support and tracking services

- [ ] Refund status service scaffold present (`RFD-001`)
- [ ] Refund status pipeline is event-driven / non-scraping (`RFD-002`)
- [ ] Refund intelligence engine capabilities declared — correlation, risk, priority (`RFD-003`)
- [ ] Analytics service binds refund intelligence + TC code engines (`RFD-004`)
- [ ] Refund tracking timeline / case workflow design approved (`RFD-005`)
- [ ] Refund status data sources limited to authorized IRS/event channels (`RFD-006`)
- [ ] Refund intelligence scoring validated against sample authorized events (`RFD-007`)
- [ ] Operator tracking UI / API contracts reviewed for PII minimization (`RFD-008`)
- [ ] Live refund-status and analytics `/health` probes respond (`RFD-009`, `--live`)

**Tracking service readiness (manual):**

| Capability | Design | Implementation | Sign-off |
| --- | --- | --- | --- |
| Status timeline |  |  |  |
| Case priority / escalation |  |  |  |
| Risk flagging |  |  |  |
| Operator notifications |  |  |  |
| Audit trail |  |  |  |

## 7. Full e-file transmission systems

- [ ] Transmission pipeline stages: prepare → validate → queue → tunnel → ack (`EFL-001`)
- [ ] API gateway declares transmission flows / guardrails (`EFL-002`)
- [ ] Secure tunnel adapter scaffold present and compliance-gated (`EFL-003`)
- [ ] Masterfile pipeline scaffold present (`EFL-004`)
- [ ] Forms and letters template directories scaffolded (`EFL-005`)
- [ ] MeF / e-file transmitter credentials and EFIN/ETIN (or successor) recorded (`EFL-006`)
- [ ] Schema validation suite for transmission payloads approved (`EFL-007`)
- [ ] Acknowledgement / rejection processing and retry policy approved (`EFL-008`)
- [ ] Production transmission kill-switch / disable path rehearsed (`EFL-009`)
- [ ] End-to-end sandbox e-file transmission validated before go-live (`EFL-010`)
- [ ] Live API gateway `/health` responds for transmission entrypoint (`EFL-011`, `--live`)

**E-file cutover gate (manual):**

| Gate | Evidence | Owner | Date |
| --- | --- | --- | --- |
| Transmitter credentials |  |  |  |
| Schema suite green |  |  |  |
| Sandbox E2E pass |  |  |  |
| Kill-switch drill |  |  |  |
| Legal + security sign-off |  |  |  |

## 8. Environment, platform, infrastructure, operations

Complete companion items in [`live-production-checklist.md`](./live-production-checklist.md) sections 3–6 (`CFG-*`, `PLT-*`, `INF-*`, `OPS-*`), including:

- [ ] Production secrets only in approved secret manager (`CFG-004`)
- [ ] `APP_ENV=prod` / `NODE_ENV=production` confirmed (`CFG-005`)
- [ ] Quality gates pass (`OPS-001`)
- [ ] Compliance report + checklist log archived (`OPS-002`, `OPS-003`)
- [ ] Enterprise tax checklist sign-offs complete (`OPS-006`)

---

## Sign-off block

| Domain | Role | Name | Date | Reference |
| --- | --- | --- | --- | --- |
| Governance | Legal |  |  |  |
| Governance | Data governance |  |  |  |
| IRS API client ID | Security / integrations |  |  |  |
| TDS client ID | Security / integrations |  |  |  |
| AI assist | Legal + Security |  |  |  |
| Refund intelligence & tracking | Product + Compliance |  |  |  |
| E-file transmission | Operations + Security |  |  |  |
| Release | Release lead |  |  |  |

## Related documents

- [`live-production-checklist.md`](./live-production-checklist.md)
- [`compliance-and-governance.md`](./compliance-and-governance.md)
- [`operations-runbook.md`](./operations-runbook.md)
- [`irm-aligned-handbook.md`](./irm-aligned-handbook.md)
- [`production-compliance-report.md`](./production-compliance-report.md)
- [`api-spec-overview.md`](./api-spec-overview.md)
