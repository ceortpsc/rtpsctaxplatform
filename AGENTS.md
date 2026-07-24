# AGENTS.md

## Cursor Cloud specific instructions

This is the **RTPSC Tax Platform Scaffold**: a Node.js (`>=22`) pnpm-workspaces monorepo of
executable stubs (`services/*`, `workers/*`, `pipelines/*`, `engines/*`, `packages/*`). All code
uses ES modules (`.mjs`) and only Node built-ins — there are **no external runtime
dependencies**, so `pnpm install` just links the workspaces.

### Running services / commands

Two equivalent runners exist:
- **Custom CLI (preferred for local dev):** `./rtpsc <command>` (or `node bin/rtpsc.mjs <command>`) —
  a dependency-free dispatcher that runs everything via `node` directly, **no package manager
  required**. Commands: `lint`, `test`, `build`, `start [service]`, `deploy [--smoke]`, `workflows`,
  `workflow run|emit …`, `agents [docs]`, `env`, `help`. Command mapping lives in `bin/rtpsc.mjs`.
- **pnpm scripts:** `pnpm run lint`, `pnpm test`, `pnpm run build`, etc. (used by CI).

- `pnpm run start` launches only the **api-gateway** on port `3000` and blocks (long-running). Start
  it in a background terminal/tmux session. Verify with `curl http://localhost:3000/health` and
  `curl http://localhost:3000/metadata`.
- Other services are independent HTTP stubs on fixed ports: refund-status `3001`, transcript `3002`,
  analytics `3003`, enrollment `3004`, invoice `3005`, pos-crm `3006`
  (`./rtpsc start refund-status|transcript|analytics|enrollment|invoice|pos-crm`).
- Workers run one-shot and print a JSON descriptor + planned steps, then exit
  (`pnpm run worker:tds`, `worker:transcript-pull`, `worker:live-source`).
- `pnpm run start:dashboard` launches the **modules-dashboard** on port `3010`: a read-only module
  catalog UI. It only lists modules; it does not trigger workflows. Views: Catalog, Insights,
  AI Assistant, Dependency Graph (sidebar + `Ctrl+K` command palette). APIs: `GET /api/modules`,
  `GET /api/insights`, `GET /api/graph`, `POST /api/assistant` (`{query}`).
- The "AI Assistant"/insights come from `packages/module-advisor` — a local, dependency-free
  heuristic engine (intent detection + keyword scoring). There is **no external LLM or API key**.
- `./rtpsc deploy` (or `pnpm run deploy:all`) starts every HTTP service (ports `3000`–`3006` + `3010`)
  plus the background `workflow-runner` as child processes, health-checks them, and stays live
  (Ctrl+C stops all). `./rtpsc deploy --smoke` verifies health once and exits. Free those ports
  first — stop any single-service dev processes so deploy doesn't hit EADDRINUSE.
- Workflows run in the **background** via the `workflow-runner` worker, not from any dashboard:
  `pnpm run start:workflows` (long-running) or `pnpm run worker:workflows` (one-shot). A single
  workflow can be run from the terminal with `pnpm run workflow:run <name> '<json>'`.

### Non-obvious notes

- The services only expose `/health` and `/metadata` (any other path returns `404`). There is no
  business logic, DB, or inter-service calls yet — "dependencies" in descriptors are metadata only.
- `docker compose up` (Postgres 16 / Redis 7 in `docker-compose.yml`) is **optional and unused by
  the code**. Do not treat Docker as a prerequisite for running or testing.
- No `.env` is required — `platform-core` defaults every config value to `unset`/sane defaults.
  Optionally copy `env/.env.local.example` to `.env` for placeholder values.
- `pnpm run lint` only checks required files exist + JSON validity; `pnpm run build` imports every
  module and writes `build/platform-manifest.json`. Neither uses ESLint/tsc/a bundler.
- The background `workflow-runner` keeps itself alive via a non-unref'd interval timer; its
  scheduled workflow timers are unref'd. Set `WORKFLOW_CYCLE_MS` to change the background cadence.
- `services/enrollment-service` (port `3004`) is the **SBTPG refund-advance enrollment interface**
  (`packages/bank-products`). Funding is guarded by a fail-safe **payment gate** — enrollment records
  intent/consent but funding stays blocked unless env=prod, platform secrets set, **SBTPG_USERNAME /
  SBTPG_SECRET provisioned**, `SBTPG_ENABLED=true`, disclosures accepted, and amount within limits.
  Operator **login clearance** lives in `packages/bank-products/src/auth.mjs`: `POST /api/auth/login`
  issues a clearance token; every attempt is appended to `logs/sbtpg-login-audit.jsonl` (gitignored)
  with redacted usernames — **never log the secret**. No real SBTPG network calls (stub).
  `./rtpsc start enrollment`.
- `services/invoice-service` (port `3005`) is the **invoicing machine** (`packages/invoice-core` +
  `packages/tax-data`). Operator flow: AI assist → create draft → submit → approve → record payment
  (confirmation) → download invoice PDF / receipt PDF / receipt-paper `.txt`. Tax rates are
  reference stubs (LA uses parishes). PDF export is a hand-rolled PDF 1.4 writer (no npm PDF libs).
  `./rtpsc start invoice`.
- `services/pos-crm-service` (port `3006`) is the integrated **POS + CRM** surface
  (`packages/crm-core`, `packages/pos-core`, `packages/ero-ops`). POS checkout auto-approves and
  settles through `invoice-core` (same tax/PDF/receipt path), then writes a CRM interaction on the
  contact. The ERO tab tracks SBTPG report traces, generates automated client/ERO phrases, and
  scores refund intelligence locally (no live SBTPG/IRS). Start with `./rtpsc start pos-crm`
  (aliases: `pos`, `crm`). Seeded demo contact: Jordan Ellis / Orleans Parish.
- `agents/*` (+ `packages/agent-core`) are a **deployment-assist & development team** — dev/deploy
  tooling, NOT a runtime product subsystem. Run with `./rtpsc agents`; regenerate the reports in
  `docs/agents/` with `./rtpsc agents docs`. They introspect the module catalog/workflows and are
  intentionally not exposed in the product dashboard/API.
