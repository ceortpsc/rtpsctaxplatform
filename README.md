# RTPSC Tax Platform Scaffold

Production-grade scaffold for a tax platform focused on secure integrations, real-time processing, compliance boundaries, and iterative delivery. This baseline is intentionally limited to compliant adapters and executable stubs; it does **not** implement unauthorized access to IRS systems, non-public channels, or scraping workflows.

## Package Manager: AOL

This monorepo uses **AOL** (Adaptive Optimized Linker) — a first-party package manager
built for workspace velocity. Instant Messenger soul, next-level speed.

```bash
./scripts/aol install     # or: make setup
./scripts/aol run lint
./scripts/aol run test
./scripts/aol run build
./scripts/aol run start
./scripts/aol bench       # velocity report vs npm
```

See [`docs/aol-package-manager.md`](docs/aol-package-manager.md).

## Platform Overview

The repository is organized as a lightweight monorepo with executable Node.js service and worker skeletons, shared packages for runtime configuration and secure tunnel interfaces, Terraform placeholders, CI scaffolding, and operations/compliance documentation.

### Included foundations

- Monorepo directory structure for services, workers, pipelines, engines, shared packages, infrastructure, scripts, docs, policy assets, forms, letters, and static assets.
- **AOL** package manager (`tools/aol`) for parallel workspace linking and script running.
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
./scripts/aol install
./scripts/aol run lint
./scripts/aol run test
./scripts/aol run build
./scripts/aol run start
```

Default gateway health check:

```bash
curl http://localhost:3000/health
```

Run workers in one-shot mode:

```bash
./scripts/aol run worker:tds
./scripts/aol run worker:transcript-pull
./scripts/aol run worker:live-source
```

## Module Map

```text
tools/
  aol/                   Adaptive Optimized Linker (package manager)
packages/
  platform-core/         shared runtime config, service helpers, worker helpers
  client-config/         API/TDS/tunnel credential placeholder definitions
  secure-tunnel/         compliant tunnel adapter interface scaffold
services/
  api-gateway/           route registry and transmission entrypoint skeleton
  refund-status-service/ event-driven refund status surface
  transcript-service/    transcript intake and orchestration surface
  analytics-service/     analytics and refund intelligence API surface
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
3. Run `./scripts/aol install`, then `./scripts/aol run start`.
4. Run `./scripts/aol run test` and `./scripts/aol run build` before opening changes.

## Documentation Index

- `/docs/aol-package-manager.md`
- `/docs/aol-api-and-config.md`
- `/docs/aol-intellectual-property.md`
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
