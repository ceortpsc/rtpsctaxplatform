# Production Activation — Fully Automated Workflows & Triggers

## Commands

```bash
# Direct automated activation (full gates)
./rtpsc activate --json
./scripts/activate-production.sh --json

# Fast local activation (skip heavy gates)
./rtpsc activate --skip-gates --json

# Status / heartbeat
./rtpsc activate --status --json
./rtpsc activate --heartbeat --json

# Workflow triggers
./rtpsc workflow emit production.activation.requested '{"mode":"automated","skipGates":false}'
./rtpsc workflow run production-activation-dispatch '{"mode":"automated","skipGates":false}'
./scripts/activate-production.sh workflow emit
./scripts/activate-production.sh workflow run
```

## Automated workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `production-activation-dispatch` | manual | Full automated activation |
| `production-activation-requested` | event `production.activation.requested` | Event-driven activation |
| `production-activation-cycle` | schedule every 180s | Readiness heartbeat |

## Agent assignment

`activate-production` → `staging-agent` on event `production.activation.requested` (also dispatched by the activation workflow after gates).

## Evidence honesty

Automated activation reaches **`AUTOMATICALLY_TESTED`** / **`STAGING_VERIFIED`** locally.

`PRODUCTION_VERIFIED` requires evidence flags:

- `--evidence-cloudFormationComplete`
- `--evidence-tlsIssued`
- `--evidence-dnsResolved`
- `--evidence-releaseAttestation`
- `--evidence-ownerApproved`

Receipts: `build/production-activation/` and `build/production-activation-status.json`.

See also: `docs/rossco-production-activation.md`, `docs/platform-full-deploy.md`.
