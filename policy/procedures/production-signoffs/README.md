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
| BND-005 | Security | `BND-005-security-review.md` |
| CFG-004 | Security / Platform | `CFG-004-secret-manager.md` |
| CFG-005 | Release / Platform | `CFG-005-runtime-env.md` |
| INF-005 | Architecture / Platform | `INF-005-terraform-prod.md` |
| OPS-004 | Operations | `OPS-004-operations.md` |
| OPS-005 | Operations | `OPS-005-oncall.md` |
