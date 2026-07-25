# @rtp/production-compliance

Full **live production checklist** (**v2.0.0**), executable **compliance report**, **checklist log**, and gate runner for the RTPSC Tax Platform scaffold.

Enterprise domains covered:

- IRS API client ID / credentials (`IRS-*`)
- TDS client ID / credentials (`TDS-*`)
- Enterprise AI assist (`AIA-*`)
- Refund intellectual support & tracking (`RFD-*`)
- Full e-file transmission systems (`EFL-*`)

Human companions: `docs/live-production-checklist.md`, `docs/enterprise-tax-software-checklist.md`.

## Commands

```bash
./scripts/aol run compliance:checklist
./scripts/aol run compliance              # run report (includes lint/test/build)
./scripts/aol run compliance -- --skip-gates
./scripts/aol run compliance -- --live    # also probe local /health endpoints
./scripts/aol run compliance:log
```

Equivalent CLI:

```bash
node ./packages/production-compliance/bin/prodcheck.mjs checklist
node ./packages/production-compliance/bin/prodcheck.mjs run --skip-gates
node ./packages/production-compliance/bin/prodcheck.mjs report --live
node ./packages/production-compliance/bin/prodcheck.mjs log
```

## Artifacts

| File | Purpose |
| --- | --- |
| `build/production-compliance-report.json` | Machine-readable compliance report |
| `build/production-compliance-report.md` | Human-readable compliance report |
| `build/production-compliance-checklist.log` | Audit checklist log |

## Modes

- **automated** — repository and scaffold gates
- **manual** — legal / security / ops sign-off (reported as `pending_signoff` unless `--strict-production`)
- **live** — HTTP `/health` probes (enabled with `--live`)

## Exit codes

- `0` — automated blockers passed (scaffold may still have pending sign-offs)
- `1` — blocker failures
- `2` — `--strict-production` with unresolved manual sign-offs
