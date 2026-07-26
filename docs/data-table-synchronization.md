# Data and table synchronization

`@rtp/data-sync` is the shared **table contract + sync engine** for RTPSC.

It imports approved CSV/JSON files into typed tables, upserts by primary key, and
projects rows into CRM (`@rtp/crm-core`) and refund (`@rtp/refund-core`) stores.

## Tables

| Table | Primary key | Consumers |
| --- | --- | --- |
| `clients` | `taxpayerRef` | CRM / POS / client portal import |
| `refund_cases` | `caseId` | Refund status / ERO dashboards |
| `invoices` | `invoiceId` | Invoice + POS settlement |
| `tax_rates` | `jurisdictionKey` | Seeded from `@rtp/tax-data` |
| `interactions` | `interactionId` | CRM timeline |
| `federal_ledger` | `returnId` | Federal refund trace / ledger import |

## CLI

```bash
./rtpsc sync status
./rtpsc sync tables
./rtpsc sync run
./rtpsc sync import clients data/sync/clients.csv
./rtpsc sync project
```

## Worker

```bash
node workers/data-sync-worker/src/index.mjs --once
# or
./scripts/aol run worker:data-sync
```

## HTTP (api-gateway `:3000`)

| Method | Path |
| --- | --- |
| `GET` | `/api/sync` |
| `GET` | `/api/sync/tables` |
| `GET` | `/api/sync/tables/:name` |
| `POST` | `/api/sync/import` `{ table, csv \| rows }` |
| `POST` | `/api/sync/run` |

POS/CRM (`:3006`) also exposes `POST /api/sync/project` to apply the clients table
into the live CRM store for that process.

## Policy

- Approved CSV/JSON only — **no scraping**, no live IRS/Treasury pulls.
- Keep live PII out of git (`data/sync/store.json` and `*.live.*` are gitignored).
- Synthetic fixtures under `data/sync/` and `data/sync/fixtures/` are safe to commit.
- Projections are idempotent; they do not bypass service auth or environment protection.
