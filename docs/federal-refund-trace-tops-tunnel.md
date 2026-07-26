# Federal Refund Trace + Gateway Communications Tunnel (Treasury TOPS)

## Modules

| Package | Role |
| --- | --- |
| `@rtp/federal-refund-trace` | Parse Full Report Export ledger, build `RefundCase` + ordered `TimelineEvent` stages + ERO/client phrasing |
| `@rtp/gateway-comms-tunnel` | Stub-safe Gateway Communications Tunnel for Treasury **TOPS** / **FFIS** / Bureau of the Fiscal Service |
| `@rtp/refund-core` | Case store: `ingestCase`, `runFullPath`, `ingestFederalLedger` |

## Policy

- Approved Full Report Export ledger only — **no scraping**, no live IRS, no live Treasury calls.
- Tunnel defaults to `status: stub` until `GATEWAY_COMMS_ENABLED=true` and TOPS/Fiscal endpoints + credentials are provisioned **and** platform environment protection allows transmission.
- Never commit live export CSVs (gitignored under `data/federal-returns/`).

## HTTP surface (`refund-status-service` `:3001`)

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/rtpsc/auth` | API/TDS client → `session_token` |
| `POST` | `/rtpsc/cases/ingest` | `refund:ingest` |
| `POST` | `/rtpsc/cases/{caseId}/run-full-path` | `refund:ingest` (+ stub TOPS session audit) |
| `GET` | `/rtpsc/cases` | list (minimal) |
| `GET` | `/rtpsc/cases/{caseId}` | `{ case, timeline }` |
| `POST` | `/rtpsc/ledger/import` | Full Report Export CSV in `body.csv` |
| `GET` | `/rtpsc/tunnel` | Gateway comms tunnel probe |
| `GET` | `/rtpsc/health` | Trace module + tunnel summary |

## Gateway (`api-gateway` `:3000`)

- `GET /rtpsc/tunnel` — local Treasury TOPS / Fiscal tunnel descriptor + probe
- `GET /rtpsc/health` — gateway tunnel health
- Proxies remaining `/rtpsc/*` to refund-status (`REFUND_STATUS_URL`, default `http://localhost:3001`)

## Timeline stages

`ingested` → `transmitted` → `accepted` | `rejected` → `funded` → `fees_settled` → `protections` → `closed`

## CLI smoke

```bash
./rtpsc start refund-status
curl -s http://localhost:3001/rtpsc/health
curl -s http://localhost:3000/rtpsc/tunnel
```
