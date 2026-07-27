# Client master file & Full ERO Client Status matrix

`@rtp/client-masterfile` provides the **alphabetical client master file** and the
**Full ERO Client Status matrix** for operator desks.

## Master file

- Canonical client rows keyed by `taxpayerRef` (when present)
- **A–Z directory** sorted last-name first (`Ellis, Jordan`)
- Lookup by **name prefix**, taxpayer ref, email, or phone
- Sync from CRM (`syncFromCrm`) and optional masterfile-pipeline ingest

## Status matrix channels

| Channel | Source |
| --- | --- |
| CRM | Contact `status` |
| Refund | Refund case `filingStage` / status / amount |
| SBTPG | Latest bank-product trace stage + product |
| E-file | Derived from filing stage / ack hints |
| Overall | `clear` · `in_progress` · `action_needed` · `unknown` |

## HTTP (pos-crm `:3006`)

| Method | Path |
| --- | --- |
| `GET` | `/api/masterfile?q=&letter=` |
| `GET` | `/api/masterfile/lookup?name=` or `?taxpayerRef=` |
| `POST` | `/api/masterfile` `{ syncFromCrm: true }` or upsert body |
| `GET` | `/api/ero/matrix?q=&letter=` |
| `GET` | `/api/contacts?sort=alpha&letter=` |
| `GET` | `/api/contacts/lookup?name=` |

UI tabs: **Master File** and **ERO Status Matrix** on `./rtpsc start pos-crm`.

## Policy

Approved operational records only — no scraping, no live IRS/SBTPG calls.
