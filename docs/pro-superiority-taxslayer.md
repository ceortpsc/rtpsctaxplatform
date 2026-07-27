# Pro Superiority vs TaxSlayer Pro–class

Ross Tax Pro Software Co positions the **Pro Desk** (`:3007`) as an ERO control surface that outpaces TaxSlayer Pro–class desktop suites on operations integration, refund intelligence, AI governance, and fail-safe e-file — while keeping live MeF calculation gated until compliance sign-off.

> Comparison is against the common Pro-suite capability pattern. **Not affiliated with TaxSlayer.**

## Quick start

```bash
./rtpsc start pro-desk          # http://localhost:3007
./rtpsc pro scorecard
./rtpsc pro diagnose --name "Jordan Ellis" --wages 42000 --withholding 4800 --eitc
./rtpsc deploy --smoke          # includes pro-desk on :3007
```

## Packages

| Package | Role |
| --- | --- |
| `@rtp/pro-superiority` | Competitive scorecard / differentiator matrix |
| `@rtp/tax-prep` | Interview modules, form catalog, return diagnostics + ROI linkage |
| `services/pro-desk-service` | Operator UI + APIs on port **3007** |

## Where RTPSC is ahead

- **Refund Optimization Intelligence** — deterministic credit scan, HOH lever, audit-grade explanation
- **Unified CRM · POS · invoicing** — not a tax-only silo
- **SBTPG payment gate** — funding blocked until prod + secrets + consent
- **AI hard prohibitions** — cannot sign, transmit, or clear material HOLD
- **Environment kill-switch** — transmit held while tunnel is stub
- **Executable compliance** — production checklist gates in-repo

## Where we are still building

- Live IRS MeF forms calculation / acceptance packs (catalog + diagnostics exist; tunnel stays stub-safe)

## APIs (pro-desk)

- `GET /api/scorecard`
- `GET /api/differentiators`
- `GET /api/guardrails`
- `GET /api/ops`
- `GET|POST /api/prep/returns`
- `POST /api/prep/returns/:id/interview`
- `POST /api/prep/returns/:id/diagnostics`
