# Web Portal + SRI-EFIN + Datastore

This document maps the RTPSC platform architecture (frontend / backend / data /
instances + gaps) and documents the multi-page **web portal**, the persistent
**datastore ("DB instances")**, and the **SRI-EFIN** provider scaffolding added
to wire routes, CTAs, APIs, registration, and DB instances together.

## 1. Architecture map

### Frontend / web surfaces

| Surface | Port | Style |
|---------|------|-------|
| **web-portal** (new) | 3011 | Multi-page **XHTML** (`application/xhtml+xml`) via a Next.js-style file router, plus **XML** surfaces (sitemap/feed/opensearch) |
| refund-status-service | 3001 | Single-page vanilla HTML operator console |
| enrollment-service | 3004 | Single-page HTML (SBTPG enrollment) |
| invoice-service | 3005 | Single-page HTML (invoicing machine) |
| pos-crm-service | 3006 | Single-page HTML (POS + CRM tabs) |
| modules-dashboard | 3010 | SPA-style HTML (catalog/insights/graph) |
| ai-workforce-hub | 8860 | HTML hire/pay UI |
| ross.py (`ross_ai`) | 8787 | Python server-rendered control plane |

All Node UIs are dependency-free (vanilla DOM + `fetch` + CSS). There is **no
Next.js/React runtime** in the repo; the web-portal implements a Next.js-style
**file-based page router** (`src/pages/*.page.mjs`) with Node built-ins to deliver
multi-page XHTML without adding npm dependencies.

### Backend

- 11 independent HTTP services (`services/*`), each its own Node process.
- Shared helpers in `packages/platform-core` (`startHttpService`, `sendJson`,
  `serveStaticFile`, config, environment protection).
- `api-gateway` (3000) authenticates API/TDS clients (`@rtp/client-identity`)
  and proxies `/api/refund/*` to refund-status.
- Background workflows via `workers/workflow-runner` + `packages/workflow-engine`.

### Data / "DB instances"

Historically every service kept **ephemeral in-memory** state (arrays/Maps lost
on restart) with optional JSONL audit files under `logs/`. Docker Postgres/Redis
and Terraform are **placeholders, unused by code**.

This change adds **`@rtp/rtp-datastore`** — a dependency-free, file-backed
document store providing named persistent **database instances** (e.g. `portal`)
with collections persisted atomically under `logs/db/<instance>/<collection>.json`.
It is the first shared persistence layer in the platform (still development-grade;
production storage remains a milestone).

### Gaps (identified, partially addressed here)

| Gap | Status |
|-----|--------|
| No shared persistence across services | **Addressed** via `@rtp/rtp-datastore` (opt-in; web-portal uses it) |
| No public multi-page site / registration | **Addressed** via `web-portal` (register/sign-in/EFIN) |
| No EFIN / e-file provider identity model | **Addressed** via `@rtp/sri-efin` scaffold |
| No cross-service shared DB, tenancy, queues | Still open (future work) |
| Other services still in-memory | Still open (datastore is opt-in) |

## 2. web-portal (`services/web-portal`, port 3011)

Multi-page XHTML/XML site with a Next.js-style router and **Signal Era**
presentations (Sovereign Ledger cream · gold · serif is not approved).

### Pages (XHTML, `application/xhtml+xml`)

`/` (home) · `/platform` · `/pricing` · `/register` · `/signin` · `/account`
· `/efin` (EFIN onboarding) · `/client-import` · `/status` · `/docs`.

Each page is a module in `src/pages/<name>.page.mjs` exporting
`{ route, title, description, getServerData?, render(data, ctx) }`. The router
(`src/router.mjs`) discovers them at startup and renders through the shared XHTML
layout (`src/layout.mjs`) plus presentation helpers (`src/presentations.mjs`:
`pageIntro`, `featureRows`, `accessBand`, `workspacePanel`). Approved fixtures
live in `assets/xhtml/`.

### XML / machine surfaces

`/sitemap.xml` · `/feed.xml` (Atom) · `/opensearch.xml` · `/robots.txt`, plus
JSON-LD (`SoftwareApplication`) embedded per page.

### JSON APIs (wired to page CTAs/forms)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/register` | Create SRI account → session cookie |
| POST | `/api/signin` | Authenticate → session cookie |
| POST | `/api/signout` | Revoke session |
| GET | `/api/session` | Current session/account |
| POST | `/api/efin` | Register an EFIN provider |
| GET | `/api/efin` | List providers (by session account) |
| POST | `/api/efin/:id/transition` | Advance suitability status |
| GET | `/api/status` | Probe all service `/health` |
| GET | `/api/platform` | Feature/provider-type summary |

Forms are progressively enhanced: with JS they submit JSON (`public/app.js`) and
show toasts; without JS they post form-encoded and the server responds with a 303
redirect. Sessions use an `HttpOnly`, `SameSite=Lax` cookie (`rtp_portal`).

## 3. SRI-EFIN (`packages/sri-efin`)

**Secure Registration & Identity — EFIN** provider scaffolding: validates EFIN
(6 digits) / ETIN (5 digits), models provider roles and a fail-safe suitability
lifecycle (`draft → submitted → suitability-pending → active`), and persists via
`@rtp/rtp-datastore`. Raw EFINs are stored but only returned **masked**
(`12••56`). This is a scaffold — no real IRS e-Services calls are made.

## 4. Run / verify

```bash
./rtpsc start web-portal      # or: pnpm run start:web-portal  → http://localhost:3011
./rtpsc lint
./rtpsc test                  # includes datastore, sri-efin, web-portal suites
./rtpsc build
pnpm run deploy:smoke         # brings up all services incl. web-portal :3011
```
