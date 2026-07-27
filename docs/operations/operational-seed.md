# Operational seed & wiring

Fully seed and wire the RTPSC application from **operator-provisioned environment
and topology** — not demo taxpayers, fake invoices, or placeholder clients.

## Command

```bash
./rtpsc seed
./rtpsc seed --json
```

Writes (gitignored):

- `logs/operational/seed-manifest.json` — firm (redacted ERO), service wiring, catalogs, unfunded inquiry roster, tunnel posture
- `logs/operational/crm-snapshot.json` — firm account + operator staff contact
- `logs/operational/refund-snapshot.json` — unfunded inquiry cases `UF-2026-001`…`005`

## Env keys

| Key | Purpose |
|---|---|
| `FIRM_LEGAL_NAME` | Firm legal name (defaults to platform identity) |
| `FIRM_EMAIL` / `OPERATOR_EMAIL` | Firm / operator email |
| `OPERATOR_NAME` | ERO / operator staff contact |
| `FIRM_ADDRESS_LINE1` / `FIRM_CITY` / `FIRM_STATE` / `FIRM_POSTAL` | Firm address |
| `ERO_PTIN` / `ERO_CAF_NUMBER` / `EFIN` / `ETIN` | ERO credentials (redacted in APIs) |
| `POS_REGISTER_ID` / `POS_CASHIER_ID` | POS defaults |
| `*_SERVICE_URL` / `API_GATEWAY_URL` / … | Optional URL overrides over topology |

## Runtime wiring

On boot, services expose `/api/operational` (where applicable) and include firm + wiring in `/metadata`:

- `api-gateway` — topology edges + refund upstream from wiring
- `refund-status-service` — seeds unfunded inquiries; full-path ingest requires explicit `caseId` / `taxpayerRef` / `amount`
- `pos-crm-service` — firm account + operator contact only (no Jordan Ellis demo)
- `invoice-service` / `enrollment-service` — catalog + firm metadata

Live IRS / SBTPG transmission remains gated. Seed data does not imply live settlement.
