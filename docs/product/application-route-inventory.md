# Application Route Inventory

Inventory of HTTP routes discovered in the RTPSC scaffold (honest: many surfaces are
stubs or operator UIs without full tax-return production capability).

## Service ports

| Service | Port | UI? |
|---------|------|-----|
| api-gateway | 3000 | No (API) |
| refund-status-service | 3001 | Yes (`public/`) |
| transcript-service | 3002 | No (health/metadata only) |
| analytics-service | 3003 | No (health/metadata only) |
| enrollment-service | 3004 | Yes |
| invoice-service | 3005 | Yes |
| pos-crm-service | 3006 | Yes |
| modules-dashboard | 3010 | Yes |
| irs-gateway | 8820 | No (`POST /irs/token` stub) |
| ai-workforce-hub | 8860 | Yes |
| Ross AI control plane | 8787 | Yes (Python) |

## api-gateway `:3000`

- `GET /health`, `GET /metadata`
- `GET /api/clients`
- `POST /api/auth/token`
- `*` `/api/refund/*` → proxies toward refund-status

## refund-status-service `:3001`

- `GET /health`, `GET /metadata`
- `GET /api/catalog`, `GET /api/clients`, `GET /api/cases`
- `POST /api/events`, `GET /api/events`
- `POST /api/refunds/full`
- Static UI `/`

## transcript-service `:3002`

- Via `startHttpService`: `GET /health`, `GET /metadata` only (API-only stub)

## analytics-service `:3003`

- `GET /health`, `GET /metadata` only (API-only stub)

## enrollment-service `:3004`

- `GET /health`, `GET /metadata`
- `GET /api/products`
- `GET|POST /api/auth/login|logout|status|clearance`, `GET /api/auth/audit`
- `GET /api/payment-gate`
- `GET|POST /api/enrollments`
- Static UI `/` (SBTPG enrollment stub + payment gate)

## invoice-service `:3005`

- `GET /health`, `GET /metadata`
- `GET /api/catalog`, `GET /api/tax`
- `POST /api/assist`
- `GET|POST /api/invoices`
- `…/api/invoices/:id/(submit|approve|pay|pdf|receipt.pdf|receipt.txt)`
- Static UI `/`

## pos-crm-service `:3006`

- `GET /health`, `GET /metadata`
- `GET /api/tax`, `/api/catalog`, `/api/contacts`, `/api/accounts`
- `GET|POST /api/pos/sessions`, `GET /api/pos/sales`, PDF/receipt paths
- `GET|POST /api/ero/phrases`, `POST /api/ero/intelligence`
- `GET|POST /api/sbtpg/traces`
- Static UI `/` (tabs: CRM, POS, ERO)

## modules-dashboard `:3010`

- `GET /health`, `GET /metadata`
- `GET /api/environment`, `/api/modules`, `/api/insights`, `/api/graph`, `/api/status`
- `POST /api/assistant` `{ query }`
- Static SPA views: catalog, insights, assistant, graph, status, design

## irs-gateway `:8820`

- `GET /health`, `GET /metadata`
- `POST /irs/token` — returns `credentials_not_configured` until secrets provisioned

## ai-workforce-hub `:8860`

- `GET /health`, `GET /metadata` (platform-core)
- `GET /v1/governance`, `/v1/personas`, `/v1/catalog`, `/v1/tasks`, `/v1/events`, `/v1/runtime`
- `POST /v1/hire`, task authenticate/scope/price/pay/queue/run/approve/hold (see source)
- Static UI `/`

## Ross AI `:8787`

### Public / SEO

- `GET /`, `/marketplace`, `/legal` (aliases `/policy`, `/disclosures`, `/rules`)
- `GET /signin` (aliases `/login`, `/sign-in`), `/signup` (aliases)
- `GET /robots.txt`, `/sitemap.xml`, `/site.webmanifest`
- `GET /static/*`
- `GET /health`, `/metadata`
- `GET /ws` (WebSocket)

### Auth / onboarding

- `POST /signup`, `/signin`, `/logout`
- `GET|POST /verify-email`, `POST /verify-email/resend`
- `GET|POST /set-password`, `/setup-mfa`, `/mfa`, `POST /mfa/email`
- `GET /auth/github`, `/auth/github/callback`

### Membership / billing

- `GET|POST /membership`, `/payment`
- `GET /billing`

### Authenticated console

- `GET /dashboard`, `/modules`, `/engines`, `/systems`, `/infrastructure` (`/foundation`)
- `GET /packages`, `/deploy`, `/runtime`
- `GET /users`, `/rbac`, `POST /rbac/assign`
- `GET|POST /execute`, `POST /execute/save`

### JSON APIs

- `GET /api/inventory`, `/api/hardening`, `/api/events`, `/api/rbac`

## Presence site

- `presence/rossco/` — static marketing for ROSS.CO (not a Node service port)
