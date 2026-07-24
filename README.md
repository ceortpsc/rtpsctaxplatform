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

## Platform Overview

The repository is organized as a lightweight monorepo with executable Node.js service and worker skeletons, shared packages for runtime configuration and secure tunnel interfaces, Terraform placeholders, CI scaffolding, and operations/compliance documentation.

### Included foundations

- Monorepo directory structure for services, workers, pipelines, engines, shared packages, infrastructure, scripts, docs, policy assets, forms, letters, and static assets.
- Environment/configuration scaffold for local, dev, stage, and prod with explicit secret placeholders.
- API gateway plus domain service skeletons for refund status, transcripts, and analytics.
- 24/7 worker skeletons for TDS, transcript pulls, and live-source fetch orchestration.
- Transmission, masterfile, and refund-status pipeline starters.
- Secure tunnel adapter scaffold with compliance checkpoints and TODO markers.
- CI placeholder workflows with lint, test, and build quality gates.

## Security and Compliance Boundaries

- No scraping flows are included.
- No unauthorized IRS or non-public integrations are implemented or implied.
- Client IDs, secrets, certificates, and tunnel credentials are environment-based only.
- Production integrations touching taxpayer data require legal approval, security review, and documented operating procedures before implementation.

## Quickstart

```bash
pnpm install
ppnpm run lint
ppnpm test
ppnpm run build
ppnpm run start
```

> This project uses **pnpm** (see `packageManager` in `package.json`). Enable it with
> `corepack enable pnpm` if you don't have it.

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

```bash
curl http://localhost:3000/health
```

Run workers in one-shot mode:

```bash
pnpm run worker:tds
pnpm run worker:transcript-pull
pnpm run worker:live-source
```

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
packages/
  platform-core/         shared runtime config, service helpers, worker helpers
  client-config/         API/TDS/tunnel credential placeholder definitions
  secure-tunnel/         compliant tunnel adapter interface scaffold
  workflow-engine/       modular task/workflow/trigger engine + run history
  module-advisor/        AI-assisted insights, assistant, and dependency graph
services/
  api-gateway/           route registry and transmission entrypoint skeleton
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
pipelines/
  transmission-pipeline/ transmission flow stages
  masterfile-pipeline/   masterfile ingestion/normalization stages
  refund-status-pipeline/event-driven refund updates stages
engines/
  refund-intelligence-engine/
  analytics-center/
  tc-code-engine/
infra/
  terraform/             module and environment placeholders
```

## Environment Model

Use the example files in `/env`:

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

## Documentation Index

- `/docs/architecture.md`
- `/docs/engineering-standards.md`
- `/docs/api-spec-overview.md`
- `/docs/operations-runbook.md`
- `/docs/compliance-and-governance.md`
- `/docs/irm-aligned-handbook.md`

## Suggested Next Milestones

1. Replace the stub secure tunnel adapter with an approved implementation after legal/compliance approval.
2. Define canonical schemas for taxpayer, transcript, and refund event contracts.
3. Add persistent storage, queue infrastructure, and contract tests for service interactions.
4. Implement authenticated API edges and operator workflows for approved users.
