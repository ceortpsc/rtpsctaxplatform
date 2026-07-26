# Ross Tax Pro Software Co — Efile Transmission Software

**Ross Tax Pro Software Co (RTPSC)** — *Efile Transmission Software*.

Production-grade scaffold for a tax e-file transmission platform focused on secure integrations, real-time processing, compliance boundaries, and iterative delivery. This baseline is intentionally limited to compliant adapters and executable stubs; it does **not** implement unauthorized access to IRS systems, non-public channels, or scraping workflows.

### Environment protection

Live IRS e-file transmission is guarded by a fail-safe **environment protection** check
(`evaluateEnvironmentProtection` in `packages/platform-core`). Transmission stays **blocked**
unless every safeguard passes: the environment is production, all secrets are configured, an
approved secure tunnel endpoint is set, and `EFILE_TRANSMISSION_ENABLED=true`. Every service
reports its protection state at `GET /metadata`; the dashboard exposes `GET /api/environment`
and a live indicator (sidebar badge + System Status panel).

## Package Managers: AOL + ROSS.CO ITR

This monorepo uses **AOL** (Adaptive Optimized Linker) for workspace linking, and
**ROSS.CO** (Infinite Transfer Rate Package Manager) for lifecycle, registration,
presence, and SEO velocity.

```bash
./scripts/aol install     # or: make setup
./scripts/aol run lint
./scripts/aol run test
./scripts/aol run build
./scripts/aol run start
./scripts/aol bench       # velocity report vs npm

./scripts/rossco transfer # Infinite Transfer Rate report
./scripts/rossco lifecycle
./scripts/rossco register
./scripts/rossco presence
./scripts/rossco seo
```

See [`docs/aol-package-manager.md`](docs/aol-package-manager.md) and
[`docs/rossco-itr-package-manager.md`](docs/rossco-itr-package-manager.md).
Refund Optimization Intelligence:
[`docs/refund-optimization-intelligence.md`](docs/refund-optimization-intelligence.md).

## Ross Tax Pro Software Co | RunTime AI Assist

**RunTime AI Assist** is the product from **Ross Tax Pro Software Co**
(full name: **Ross Tax Pro Software Co | RunTime AI Assist**) —
landing, access gates, dashboards, membership, RBAC, GitHub sign-in, transparent
execution, and advanced SEO on **http://127.0.0.1:8787**.

```bash
python3 ross.py init
python3 ross.py doctor
python3 ross.py package build      # → workspace/dist/application.rpkg
python3 ross.py runtime run hello
python3 ross.py deploy plan local
python3 ross.py dev                # open http://127.0.0.1:8787
# Create account → verify email → MFA → membership → payment
```

SEO: `/robots.txt`, `/sitemap.xml`, `/site.webmanifest` (set `ROSS_PUBLIC_URL` in production).

Docker: `docker compose -f docker-compose.ross.yml up --build`.  
Details: [`docs/ross-ai-runtime-platform.md`](docs/ross-ai-runtime-platform.md).

## Platform Overview

The repository is organized as a lightweight monorepo with executable Node.js service and worker skeletons, shared packages for runtime configuration and secure tunnel interfaces, Terraform placeholders, CI scaffolding, and operations/compliance documentation.

### Included foundations

- Monorepo directory structure for services, workers, pipelines, engines, shared packages, infrastructure, scripts, docs, policy assets, forms, letters, and static assets.
- **AOL** package manager (`tools/aol`) for parallel workspace linking and script running.
- Environment/configuration scaffold for local, dev, stage, and prod with explicit secret placeholders.
- API gateway plus domain service skeletons for refund status, transcripts, analytics, and IRS OAuth/TDS gateway.
- Cursor Cloud environment pack (`.cursor/environment.json`), root `Dockerfile`, and Python `requirements.txt` for PDF fill tooling.
- 24/7 worker skeletons for TDS, transcript pulls, and live-source fetch orchestration.
- Transmission, masterfile, and refund-status pipeline starters.
- Secure tunnel adapter scaffold with compliance checkpoints and TODO markers.
- Production compliance package (`@rtp/production-compliance`) with full live checklist, report, and audit log.
- CI placeholder workflows with lint, test, and build quality gates.

## Security and Compliance Boundaries

- No scraping flows are included.
- No unauthorized IRS or non-public integrations are implemented or implied.
- Client IDs, secrets, certificates, and tunnel credentials are environment-based only.
- Production integrations touching taxpayer data require legal approval, security review, and documented operating procedures before implementation.

## Full API client id + TDS client id

`packages/client-identity` issues and authenticates **full** API and TDS client credentials
(scopes, audit log, hashed secret registry under `logs/`). Prefer the custom CLI:

```bash
./rtpsc clients issue api --name "Ops API"
./rtpsc clients issue tds --name "TDS Pull"
./rtpsc clients export-env    # prints export API_CLIENT_* / TDS_CLIENT_*
./rtpsc clients status
```

The **api-gateway** (`:3000`) authenticates API clients (`POST /api/auth/token`) and proxies
`/api/refund/*` to the refund service. The **tds-worker** authenticates TDS clients before
simulated pull jobs.

## Full refund center

`packages/refund-core` + upgraded `services/refund-status-service` (`:3001`) provide full refund
cases: approved-event ingest → pipeline stages → `refund-status-update` workflow → intelligence
timeline. UI at `http://localhost:3001`. Write paths require an API or TDS client.

```bash
./rtpsc start refund-status
# POST /api/events  or  POST /api/refunds/full   (with x-api-client-id / x-api-client-secret)
```

## Quickstart

Use the built-in **`rtpsc`** command runner — a dependency-free CLI that drives everything through
`node` directly (no package manager required to run tasks):

```bash
./rtpsc help          # list all commands
./rtpsc lint
./rtpsc test
./rtpsc build
./rtpsc start         # api-gateway (or: ./rtpsc start dashboard)
./rtpsc deploy        # all services + background worker (add --smoke to verify & exit)
./rtpsc workflow run transcript-intake '{"requestId":"REQ-1","authorized":true}'
./rtpsc agents        # deployment-assist & development team
./rtpsc agents list   # required task assignments + triggers
./rtpsc agents run required   # execute assigned agents for required tasks
./rtpsc agents docs   # write docs/agents markdown
./rtpsc env           # environment protection status
```

`rtpsc` is a thin wrapper over `bin/rtpsc.mjs` (also exposed as a `bin` entry); run it as
`./rtpsc <command>` or `node bin/rtpsc.mjs <command>`.

Install dependencies with your package manager of choice; this repo is configured for **pnpm**
(`pnpm install`; `corepack enable pnpm` if needed). The equivalent pnpm scripts remain available
and are used by CI.

## Deploy all (development)

Bring up the whole platform — every HTTP service plus the background
`workflow-runner` — with one command:

```bash
pnpm run deploy:all     # starts all components, health-checks them, stays live
pnpm run deploy:smoke   # same, but verifies health once and exits (CI smoke check)
```

Services: api-gateway `:3000`, refund-status `:3001`, transcript `:3002`,
analytics `:3003`, modules-dashboard `:3010`.

Default gateway health check:
./scripts/aol install
./scripts/aol run lint
./scripts/aol run test
./scripts/aol run build
./scripts/aol run start:all    # entire platform (tmux)
./scripts/aol run start:check  # health probe all services
```

Or foreground supervisor: `./scripts/aol run start:all:fg`.

Default health checks:

```bash
curl http://localhost:3000/health   # api-gateway
curl http://localhost:3001/health   # refund-status
curl http://localhost:3002/health   # transcript
curl http://localhost:3003/health   # analytics
```

Workers also run once during `start:all`. Manual one-shot:

```bash
pnpm run worker:tds
pnpm run worker:transcript-pull
pnpm run worker:live-source
```

## Bank products — SBTPG refund advance (payment gate + enrollment)

`packages/bank-products` models **Santa Barbara Tax Products Group (SBTPG)** refund-advance /
refund-transfer products with required disclosures, a fail-safe **payment gate**, and enrollment
logic. `services/enrollment-service` (port `3004`) exposes the REST API and a taxpayer
**enrollment interface**.

- Products: `RA-NF` (No-Fee Refund Advance), `RA-FC` (Refund Advance w/ finance charge), `RT` (Refund Transfer).
- **Payment gate is fail-safe:** enrollment records taxpayer intent + consent, but **funding stays
  blocked** unless the environment is production, provider secrets are configured, `SBTPG_ENABLED=true`,
  disclosures are accepted, and the amount is within product limits. No real SBTPG integration is
  performed (stub adapter, pending bank/legal/security sign-off).

```bash
./rtpsc start enrollment      # http://localhost:3004  (enrollment UI)
```

REST API: `GET /api/products`, `GET /api/payment-gate`, `POST /api/enrollments`,
`GET /api/enrollments[/:id]`, plus `/health` + `/metadata`.

### SBTPG login validation & clearance (audited)

Operator credentials are provisioned via environment only (`SBTPG_USERNAME`, `SBTPG_SECRET`) —
never hard-coded. `packages/bank-products/src/auth.mjs` validates logins with timing-safe
comparison, issues a short-lived **clearance token**, and appends every attempt to
`logs/sbtpg-login-audit.jsonl` (username redacted; secrets never logged).

```bash
export SBTPG_USERNAME='…'
export SBTPG_SECRET='…'
./rtpsc start enrollment   # login panel at http://localhost:3004
```

Auth API: `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout`,
`GET /api/auth/clearance`, `GET /api/auth/audit[?persisted=1]`.

## Invoicing machine — operations, tax calc, PDF & receipt paper

`packages/tax-data` holds **state + county/parish** taxation reference rates (Louisiana uses
parishes). `packages/invoice-core` is the invoicing machine: local **AI-assisted data entry**,
line-item/tax calculations, payment **approval → confirmation**, and export to **PDF** plus
**receipt paper** (thermal `.txt` and narrow receipt PDF). `services/invoice-service` (port
`3005`) exposes the REST API and operator UI.

```bash
./rtpsc start invoice      # http://localhost:3005  (invoicing machine UI)
```

Lifecycle: `draft` → `pending-approval` → `approved` → `paid` (+ confirmation).  
REST: `POST /api/assist`, `GET /api/tax`, `GET /api/catalog`, `POST /api/invoices`,
`POST /api/invoices/:id/{submit,approve,pay}`, `GET /api/invoices/:id/{pdf,receipt.pdf,receipt.txt}`.

Rates are reference/stub data for development — confirm with the tax authority before production use.

## POS + CRM (integrated operations) · ERO / SBTPG intelligence

Modular engineering packages fully integrated with the existing operating stack:

| Package | Role |
|---------|------|
| `@rtp/crm-core` | Contacts, household accounts, interaction timeline |
| `@rtp/pos-core` | POS sessions/carts; checkout settles via **invoice-core** + tax-data |
| `@rtp/ero-ops` | SBTPG report **tracking/tracing**, automated **ERO phrasing**, refund-intelligence scoring |

`services/pos-crm-service` (port **3006**) exposes a unified operator UI (CRM · Point of Sale · Refund Intel / SBTPG) and REST APIs. POS sales attach to CRM contacts, write interactions, create paid invoices, and offer PDF / receipt-paper downloads.

```bash
./rtpsc start pos-crm     # http://localhost:3006  (aliases: pos, crm)
```

REST highlights: `GET/POST /api/contacts`, `POST /api/pos/sessions` → `/items` → `/checkout`,
`GET/POST /api/sbtpg/traces`, `POST /api/ero/phrases`, `POST /api/ero/intelligence`.

## Deployment Assist & Development Team

A virtual **deployment-assist and development team** ships as developer/deployment tooling under
`agents/*` (with shared `packages/agent-core`). These are **not** a runtime subsystem of the
product — they analyze the codebase and produce reports + documentation to assist development and
deployment.

| Team member | Role |
|-------------|------|
| `planning-agent` | Phased delivery plan, milestones, exit criteria |
| `scoping-agent` | Inventory, complexity index, scope boundaries |
| `testing-agent` | Validations & verifications across catalog + workflows |
| `mapping-agent` | Dependency map & enhancement recommendations |
| `staging-agent` | Staged rollout / promotion pipeline with gates |
| `assessment-agent` | Environmental assessment & inspection with findings |
| `markdown-agent` | Markdown generation engine (writes `docs/agents/*`) |

```bash
./rtpsc agents                 # run the team, print a JSON summary
./rtpsc agents docs            # regenerate docs/agents/*.md
./rtpsc agents list            # required task assignments + triggers
./rtpsc agents run required    # execute assigned agents for required tasks
./rtpsc agents trigger event '{"assignmentId":"validate-platform"}'
./rtpsc agents workflow emit agent.task.requested '{"assignmentId":"assess-environment"}'
```

Required tasks are pre-assigned on the agent assignment board and dispatched through
`agent-assignment-dispatch` (manual), `agent-task-requested` (event), and
`agent-assignment-cycle` (schedule). See [`docs/CURSOR_TERMINAL_AGENT.md`](./docs/CURSOR_TERMINAL_AGENT.md).
Generated reports live in [`docs/agents/`](./docs/agents/README.md).

## Background Workflows

The platform ships a modular workflow engine (`packages/workflow-engine`) plus
domain workflows under `workflows/*`. Workflows run **in the background** via the
`workflow-runner` worker (`workers/workflow-runner`) — they are not triggered
from any dashboard.

Run all workflows in the background (schedules fire automatically, event/manual
workflows are driven on a cadence; every completed run is logged):

```bash
pnpm run start:workflows        # long-running background runner
pnpm run worker:workflows       # one-shot: run every workflow once and exit
```

Trigger a single workflow from the terminal:

```bash
pnpm run workflow:list
pnpm run workflow:run transcript-intake '{"requestId":"REQ-1","authorized":true}'
```

## Modules Dashboard

The dashboard (`services/modules-dashboard`) is a **read-only inventory of
platform modules only** (packages, services, workers, pipelines, engines, and
workflow definitions). It does not trigger workflows.

```bash
pnpm run start:dashboard
# then open http://localhost:3010
```

The dashboard has four views with a sidebar and a `Ctrl+K` command palette:

- **Catalog** — searchable/filterable module inventory with per-module details
- **Insights** — AI-assisted metrics (trigger distribution, category counts) and recommendations
- **AI Assistant** — ask natural-language questions about modules (local heuristic engine, no external LLM)
- **Dependency Graph** — layered SVG graph of module dependencies and workflow-runner links

REST API (served by the dashboard):

- `GET /api/modules` — categorized catalog of all platform modules
- `GET /api/insights` — insights + recommendations (from `@rtp/module-advisor`)
- `GET /api/graph` — dependency graph nodes/edges
- `POST /api/assistant` — natural-language query (`{ "query": "..." }`) → answer + matches
- `GET /health` and `GET /metadata` — service health and module summary

## Module Map

```text
tools/
  aol/                   Adaptive Optimized Linker (workspace linker)
  rossco/                ROSS.CO Infinite Transfer Rate package manager
presence/
  rossco/                Online presence + SEO landing (ross.co)
  aol/                   Adaptive Optimized Linker (package manager)
ross.py / ross_ai/       Ross Tax Pro Software Co | RunTime AI Assist (packages, runtime, deploy)
packages/
  platform-core/         shared runtime config, service helpers, worker helpers
  client-config/         API/TDS/tunnel credential placeholder definitions
  secure-tunnel/         compliant tunnel adapter interface scaffold
  workflow-engine/       modular task/workflow/trigger engine + run history
  module-advisor/        AI-assisted insights, assistant, and dependency graph
  ero-governance/        RTP-AI-001 personas, catalog, paid-task state machine
services/
  api-gateway/           route registry and transmission entrypoint skeleton
  irs-gateway/           IRS OAuth2 / TDS token gateway (JWT client assertion)
  ai-workforce-hub/      realtime AI persona hire/pay UI + APIs (RTP-AI-001)
  refund-status-service/ event-driven refund status surface
  transcript-service/    transcript intake and orchestration surface
  analytics-service/     analytics and refund intelligence API surface
  modules-dashboard/     read-only dashboard + REST API for platform modules
workflows/
  refund-status-workflow/    event-driven refund status update workflow
  transcript-intake-workflow/ authorization-gated transcript intake workflow
  transmission-workflow/     scheduled transmission cycle workflow
workers/
  workflow-runner/       runs all workflows in the background (schedules/events)
workers/
  tds-worker/            TDS orchestration worker scaffold
  transcript-pull-worker/account transcript pull worker scaffold
  live-source-fetcher/   approved-source fetch coordinator scaffold
  ai-persona-worker/     paid persona queue worker scaffold
pipelines/
  transmission-pipeline/ transmission flow stages
  masterfile-pipeline/   masterfile ingestion/normalization stages
  refund-status-pipeline/event-driven refund updates stages
engines/
  refund-intelligence-engine/  lifecycle, guard, ETA, ROI handoff
  refund-optimization-engine/  Refund = withholding + credits − liability
  ai-persona-runtime/          hire→pay→run orchestration under ERO gates
  analytics-center/
  tc-code-engine/
  pdf-fill-engine/       Python PDF fill scaffold (`requirements.txt`)
infra/
  terraform/             module and environment placeholders
.cursor/
  environment.json       Cursor Cloud agent environment definition
```

## Environment Model

Use the example files in `/env` and root `.env.example`. Cursor setup: [`docs/cursor-environment.md`](docs/cursor-environment.md).

- `env/.env.local.example`
- `env/.env.dev.example`
- `env/.env.stage.example`
- `env/.env.prod.example`

Key placeholders include:

- `API_CLIENT_ID`
- `API_CLIENT_SECRET`
- `TDS_CLIENT_ID`
- `TDS_CLIENT_SECRET`
- `TUNNEL_CLIENT_ID`
- `TUNNEL_CLIENT_SECRET`
- `APPROVED_TUNNEL_ENDPOINT`

## Local Development Workflow

1. Copy the appropriate `env/.env.<environment>.example` file into a local untracked `.env` file.
2. Run `docker compose up -d` to provision local Postgres and Redis placeholders.
3. Run `pnpm run setup`, then `pnpm run start`.
4. Run `pnpm test` and `pnpm run build` before opening changes.
3. Run `./scripts/aol install`, then `./scripts/aol run start`.
4. Run `./scripts/aol run test` and `./scripts/aol run build` before opening changes.

## Documentation Index

- `/docs/aol-package-manager.md`
- `/docs/aol-api-and-config.md`
- `/docs/aol-intellectual-property.md`
- `/docs/ross-ai-runtime-platform.md`
- `/docs/rtpsc-package-lock.md`
- `/docs/architecture.md`
- `/docs/engineering-standards.md`
- `/docs/api-spec-overview.md`
- `/docs/operations-runbook.md`
- `/docs/compliance-and-governance.md`
- `/docs/live-production-checklist.md`
- `/docs/enterprise-tax-software-checklist.md`
- `/docs/production-compliance-report.md`
- `/docs/irm-aligned-handbook.md`

## Suggested Next Milestones

1. Replace the stub secure tunnel adapter with an approved implementation after legal/compliance approval.
2. Define canonical schemas for taxpayer, transcript, and refund event contracts.
3. Add persistent storage, queue infrastructure, and contract tests for service interactions.
4. Implement authenticated API edges and operator workflows for approved users.
