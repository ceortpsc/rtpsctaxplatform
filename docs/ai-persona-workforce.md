# AI Persona Workforce Hub

Implements Ross Tax Pro Software Co. **RTP-AI-001** (AI Persona Governance) and the paid-service hub from the Master Governance / ERO / AI Operations E-Manual v2.0.

> PRIVATE-COMPANY MANUAL controls — **not** an IRS publication.

## Hard rules (enforced in code)

AI personas **cannot**:

- sign for a person
- transmit a return
- represent a taxpayer
- clear a material HOLD
- change bank data
- approve a refund
- decide a material tax position
- issue a final legal conclusion

without authorized human review.

## Components

| Module | Path | Role |
|--------|------|------|
| Governance | `packages/ero-governance` | Personas, CRM/IRM gates, catalog, paid-task state machine |
| Runtime | `engines/ai-persona-runtime` | Hire → pay → realtime step orchestration |
| Hub | `services/ai-workforce-hub` | API + UI on `:8860` |
| Worker | `workers/ai-persona-worker` | Queue polling scaffold |

## Paid task states

`REQUESTED → AUTHENTICATED → SCOPED → PRICED → PAID_APPROVED → QUEUED → IN_PROGRESS → HUMAN_REVIEW → DELIVERED → ACKNOWLEDGED → RETAINED`

Branch states: `NEEDS_INFO`, `FLAG`, `HOLD`, `ESCALATED`, `CANCELLED`, `DISENGAGED`.

## Run

```bash
./scripts/aol run start:ai-workforce
# UI http://127.0.0.1:8860/
curl -s http://127.0.0.1:8860/v1/personas
curl -s -X POST http://127.0.0.1:8860/v1/live-service \
  -H 'content-type: application/json' \
  -d '{"serviceCode":"TAX-101","personaId":"concierge","clientReference":"c-1","autoHumanApprove":true}'
```

## Rollout notes

1. Keep hub in Personal / staged environment first.
2. Connect real payment processor only after FIN-001 + security review.
3. Production AI model calls require approved vendor controls (no taxpayer data in public tools).
4. Human reviewers must clear HOLD / high-risk HUMAN_REVIEW before delivery.
