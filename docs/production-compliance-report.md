# Production Compliance Report Guide

The platform ships an executable **production compliance report** plus a durable
**checklist log**. Use these before any live production cutover.

## Package

`@rtp/production-compliance` (CLI: `prodcheck`)

## Commands

```bash
./scripts/aol run compliance:checklist   # print full checklist
./scripts/aol run compliance             # run report + quality gates
./scripts/aol run compliance -- --skip-gates
./scripts/aol run compliance -- --live
./scripts/aol run compliance -- --live --strict-production
./scripts/aol run compliance:log         # print latest checklist log
```

## Report contents

The report covers eleven sections (checklist **v2.0.0**), including IRS API / TDS
client IDs, AI assist, refund intelligence & tracking, and e-file transmission:

1. Legal, governance, and IRM alignment
2. Security and compliance boundaries
3. Environment and secret configuration
4. Platform modules, services, and workers
5. Infrastructure and CI gates
6. Go-live operations and evidence

Each checklist item is classified as:

- `automated` — verified by the runner
- `manual` — requires human sign-off evidence
- `live` — HTTP health probes (opt-in with `--live`)

## Overall verdicts

| Verdict | Meaning |
| --- | --- |
| `pass` | All checks passed, including no pending sign-offs |
| `ready_scaffold` | Automated scaffold gates passed; manual sign-offs still open |
| `warn` | Completed with warning-severity findings |
| `fail` | Blocker findings must be resolved |

For the current stub scaffold, `ready_scaffold` is the expected healthy state
until legal, security, data-governance, and operations sign-offs are recorded.

## Artifacts and retention

| Artifact | Path |
| --- | --- |
| JSON report | `build/production-compliance-report.json` |
| Markdown report | `build/production-compliance-report.md` |
| Checklist log | `build/production-compliance-checklist.log` |

Retain the JSON report and checklist log with the release evidence pack.

## CI

`.github/workflows/compliance.yml` verifies compliance documentation and runs
`prodcheck run --skip-gates` so pull requests prove the checklist and report
pipeline remain intact.
