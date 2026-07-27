# Client ID # and Customer ID # issuance

`@rtp/party-identity` issues human-readable tax-party numbers:

| Kind | Prefix | Example | Use |
| --- | --- | --- | --- |
| **Client ID #** | `CL-` | `CL-000001` | ERO tax-prep client record |
| **Customer ID #** | `CU-` | `CU-000001` | Billing / POS customer record |

These are **not** API/TDS machine credentials (`rtp_api_*` / `rtp_tds_*` from `@rtp/client-identity`).

## CLI

```bash
./rtpsc ids status
./rtpsc ids issue client --name "Jordan Ellis" --taxpayer-ref TP-77
./rtpsc ids issue customer --name "Jordan Ellis"
./rtpsc ids issue pair --name "Jordan Ellis"
./rtpsc ids lookup CL-000001
./rtpsc ids list client
```

## HTTP (pos-crm `:3006`)

| Method | Path |
| --- | --- |
| `GET` | `/api/ids` |
| `POST` | `/api/ids/client` |
| `POST` | `/api/ids/customer` |
| `POST` | `/api/ids/pair` |
| `GET` | `/api/ids/lookup?number=CL-000001` |

Creating a CRM contact auto-issues both numbers unless `issueIds: false`.

## Persistence

Registry: `logs/party-identity-registry.json` (gitignored)  
Audit: `logs/party-identity-audit.jsonl` (gitignored)
