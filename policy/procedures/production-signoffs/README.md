# Production Sign-off Pack

Human approval slots for live production cutover. The compliance runner reads
`registry.json` and marks checklist items `pass` only when a sign-off has
`status: "approved"` with `approver` and `approvedAt` set.

## Rules

1. Never set `status` to `approved` without a real dated human approval.
2. Keep evidence references relative to the repo root.
3. Do not put secrets, certificates, or taxpayer data in these files.
4. After updating the registry, re-run:

```bash
./scripts/aol run compliance -- --live
```

## Checklist IDs covered

| ID | Role | Template |
| --- | --- | --- |
| GOV-005 | Legal | `GOV-005-legal-approval.md` |
| GOV-006 | Data governance | `GOV-006-data-governance.md` |
| GOV-008 | Legal / Governance | `GOV-008.md` |
| BND-005 | Security | `BND-005-security-review.md` |
| IRS-005 | IRS / Credentials | `IRS-005.md` |
| IRS-006 | IRS / Credentials | `IRS-006.md` |
| IRS-007 | IRS / Credentials | `IRS-007.md` |
| IRS-008 | IRS / Credentials | `IRS-008.md` |
| TDS-005 | TDS / Credentials | `TDS-005.md` |
| TDS-006 | TDS / Credentials | `TDS-006.md` |
| TDS-007 | TDS / Credentials | `TDS-007.md` |
| TDS-008 | TDS / Credentials | `TDS-008.md` |
| AIA-005 | AI Assist / Compliance | `AIA-005.md` |
| AIA-006 | AI Assist / Compliance | `AIA-006.md` |
| AIA-007 | AI Assist / Compliance | `AIA-007.md` |
| AIA-008 | AI Assist / Compliance | `AIA-008.md` |
| RFD-005 | Product / Refund Ops | `RFD-005.md` |
| RFD-006 | Product / Refund Ops | `RFD-006.md` |
| RFD-007 | Product / Refund Ops | `RFD-007.md` |
| RFD-008 | Product / Refund Ops | `RFD-008.md` |
| EFL-006 | E-file / Transmission | `EFL-006.md` |
| EFL-007 | E-file / Transmission | `EFL-007.md` |
| EFL-008 | E-file / Transmission | `EFL-008.md` |
| EFL-009 | E-file / Transmission | `EFL-009.md` |
| EFL-010 | E-file / Transmission | `EFL-010.md` |
| CFG-004 | Security / Platform | `CFG-004-secret-manager.md` |
| CFG-005 | Release / Platform | `CFG-005-runtime-env.md` |
| INF-005 | Architecture / Platform | `INF-005-terraform-prod.md` |
| OPS-004 | Operations | `OPS-004-operations.md` |
| OPS-005 | Operations | `OPS-005-oncall.md` |
| OPS-006 | Operations | `OPS-006.md` |
