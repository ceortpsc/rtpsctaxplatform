# AGENTS.md

## Cursor Cloud specific instructions

This is the **RTPSC Tax Platform Scaffold**: a Node.js (`>=22`) pnpm-workspaces monorepo of
executable stubs (`services/*`, `workers/*`, `pipelines/*`, `engines/*`, `packages/*`). All code
uses ES modules (`.mjs`) and only Node built-ins — there are **no external runtime
dependencies**, so `pnpm install` just links the workspaces.
This is the **RTPSC Tax Platform Scaffold**: a Node.js (`>=22`) monorepo of executable
stubs (`services/*`, `workers/*`, `pipelines/*`, `engines/*`, `packages/*`). All code uses
ES modules (`.mjs`) and only Node built-ins — there are **no external runtime
dependencies**.

### Package managers: AOL + ROSS.CO ITR

Use **AOL** (Adaptive Optimized Linker) for workspace linking instead of npm:

```bash
./scripts/aol install          # parallel workspace link + RTPSC-package-lock.json
./scripts/aol run lint
./scripts/aol run test
./scripts/aol run build
./scripts/aol run start
./scripts/aol run worker:tds
./scripts/aol bench            # compare install speed vs npm
./scripts/aol run compliance   # live production checklist + compliance report/log
```

Use **ROSS.CO** (Infinite Transfer Rate Package Manager) for product lifecycle /
transfer-rate / register / presence / SEO:

Docs: `docs/aol-package-manager.md`, `docs/aol-api-and-config.md`,
`docs/aol-intellectual-property.md`, `docs/live-production-checklist.md`,
`docs/enterprise-tax-software-checklist.md`, `docs/production-compliance-report.md`.
```bash
./scripts/rossco install       # ITR transfer (delegates link to AOL)
./scripts/rossco lifecycle
./scripts/rossco validate
./scripts/rossco register
./scripts/rossco presence
./scripts/rossco seo
```

Equivalent: `node ./tools/aol/bin/aol.mjs <cmd>`, `node ./tools/rossco/bin/rossco.mjs <cmd>`,
or `make setup|lint|test|build|start|bench|compliance|rossco`.

Docs: `docs/aol-package-manager.md`, `docs/rossco-itr-package-manager.md`,
`docs/rossco-intellectual-property.md`, `docs/refund-optimization-intelligence.md`,
`docs/aol-api-and-config.md`, `docs/live-production-checklist.md`.

Concept extras: `aol commands`, `aol config`, `aol codes`, `aol api`,
`aol copyright`, `aol doctor`, `aol graph`, `aol mail`, `aol whoami`,
`rossco lifecycle|plan|scope|stage|verify|register|seo`.

Two equivalent runners exist:
- **Custom CLI (preferred for local dev):** `./rtpsc <command>` (or `node bin/rtpsc.mjs <command>`) —
  a dependency-free dispatcher that runs everything via `node` directly, **no package manager
  required**. Commands: `lint`, `test`, `build`, `start [service]`, `deploy [--smoke]`, `workflows`,
  `workflow run|emit …`, `agents [docs|list|assign|run|required|trigger|workflow]`,
  `canvas [create|list|…]`, `clients …`, `env`, `help`. Mapping in `bin/rtpsc.mjs`.
  Cursor Canvases: `./rtpsc canvas create all` → `.cursor/canvases/`
  (docs: `docs/cursor-canvas.md`, skill: `.cursor/skills/rtpsc-canvas`).
- **pnpm scripts:** `pnpm run lint`, `pnpm test`, `pnpm run build`, etc. (used by CI).

- `pnpm run start` launches only the **api-gateway** on port `3000` and blocks (long-running). Start
  it in a background terminal/tmux session. Verify with `curl http://localhost:3000/health` and
  `curl http://localhost:3000/metadata`.
- Other services on fixed ports: refund-status `3001` (**full refund center** + client auth),
  transcript `3002`, analytics `3003`, enrollment `3004`, invoice `3005`, pos-crm `3006`
  (`./rtpsc start refund-status|transcript|analytics|enrollment|invoice|pos-crm`).
- **API/TDS clients:** `./rtpsc clients issue api|tds` writes one-time secrets to
  `logs/issued-client-secrets.json` (gitignored). Gateway and refund-status auto-ensure local
  clients on boot if none exist (secrets printed once to the service console). Auth headers:
  `x-api-client-id` / `x-api-client-secret` (or HTTP Basic). Never commit client secrets.
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
  `docs/agents/` with `./rtpsc agents docs`. Required tasks are pre-assigned on the assignment board
  (`./rtpsc agents list|assign|run|required|trigger`); agent-assignment workflows
  (`agent-assignment-dispatch`, `agent-task-requested`, `agent-assignment-cycle`) run via the
  workflow-runner triggers. See `docs/CURSOR_TERMINAL_AGENT.md`. They introspect the module
  catalog/workflows and are intentionally not exposed in the product dashboard/API.
- Cursor Canvases: `packages/canvas-core` + `./rtpsc canvas` generate Agents Window artifacts under
  `.cursor/canvases/` (see `docs/cursor-canvas.md`).
### Cursor Cloud environment

- Repo definition: `.cursor/environment.json` (+ `.cursor/Dockerfile`).
- Linked repository: `ceortpsc/rtpsctaxplatform` (Personal scope).
- Env templates: `.env.example`, `env/.env.*.example`. Set real IRS secrets only in the
  Cursor Personal environment / approved secret store — never commit them.
- Details: `docs/cursor-environment.md`. Banner: `assets/banners/primeweb-motd.txt`.

### Ross Tax Pro Software Co | RunTime AI Assist

**RunTime AI Assist** (full name: **Ross Tax Pro Software Co | RunTime AI Assist**)
is the operator control plane
(landing, access gates, dashboards, inventory, hardening, WebSockets, RBAC,
GitHub auth, transparent execution) on port `8787`, with advanced SEO
(`/robots.txt`, `/sitemap.xml`, JSON-LD). Docs: `docs/ross-ai-runtime-platform.md`.

```bash
python3 ross.py init
python3 ross.py doctor
python3 ross.py package build
python3 ross.py runtime run hello
python3 ross.py deploy plan docker
python3 ross.py dev                 # http://127.0.0.1:8787
# Landing → /signup or /signin → /dashboard
```

Docker (optional): `cp .env.example .env && docker compose -f docker-compose.ross.yml up --build`.
### Cursor Cloud environment

- Repo definition: `.cursor/environment.json` (+ `.cursor/Dockerfile`).
- Linked repository: `ceortpsc/rtpsctaxplatform` (Personal scope).
- Env templates: `.env.example`, `env/.env.*.example`. Set real IRS secrets only in the
  Cursor Personal environment / approved secret store — never commit them.
- Details: `docs/cursor-environment.md`. Banner: `assets/banners/primeweb-motd.txt`.

### Running services / commands

- `./scripts/aol run start:all` (or `make start-all`) launches the **entire platform** under
  tmux: api-gateway `:3000`, refund-status `:3001`, transcript `:3002`, analytics `:3003`,
  then runs workers once (`tds`, `transcript-pull`, `live-source`). Status:
  `build/platform-runtime-status.json`. Health: `./scripts/aol run start:check`.
- `./scripts/aol run start` launches only the **api-gateway** on port `3000` and blocks
  (long-running). Verify with `curl http://localhost:3000/health`.
- Individual services: `start:refund-status`, `start:transcript`, `start:analytics`.
- Workers one-shot: `worker:tds`, `worker:transcript-pull`, `worker:live-source`.
- Docker Compose (Postgres/Redis) is optional and unused by stubs.
  (long-running). Start it in a background terminal/tmux session. Verify with
  `curl http://localhost:3000/health` and `curl http://localhost:3000/metadata`.
- Other services are independent HTTP stubs on fixed ports: refund-status `3001`,
  transcript `3002`, analytics `3003`, irs-gateway `8820`, ai-workforce-hub `8860`
  (`./scripts/aol run start:refund-status`, `start:transcript`, `start:analytics`,
  `start:irs-gateway`, `start:ai-workforce`).
  transcript `3002`, analytics `3003`, irs-gateway `8820`
  (`./scripts/aol run start:refund-status`, `start:transcript`, `start:analytics`,
  `start:irs-gateway`).
- Workers run one-shot and print a JSON descriptor + planned steps, then exit
  (`./scripts/aol run worker:tds`, `worker:transcript-pull`, `worker:live-source`,
  `worker:ai-persona`).
- Production compliance: `./scripts/aol run compliance:checklist`,
  `./scripts/aol run compliance -- --skip-gates`,
  `./scripts/aol run compliance -- --live`,
  `./scripts/aol run compliance:log`.
  Artifacts: `build/production-compliance-report.json`,
  `build/production-compliance-report.md`,
  `build/production-compliance-checklist.log`.

### Non-obvious notes

- Most services only expose `/health` and `/metadata` (any other path returns `404`).
  `irs-gateway` also exposes `POST /irs/token` (JWT client assertion) and returns
  `credentials_not_configured` until secrets/keys are provisioned.
  `ai-workforce-hub` exposes hire/pay/run persona APIs + UI under RTP-AI-001
  (AI cannot sign, transmit, or clear material HOLD).
  There is no DB or inter-service mesh yet — "dependencies" in descriptors are metadata only.
- `docker compose up` (Postgres 16 / Redis 7 in `docker-compose.yml`) is **optional and
  unused by the code**. Do not treat Docker as a prerequisite for running or testing.
- No `.env` is required — `platform-core` defaults every config value to `unset`/sane
  defaults. Optionally copy `env/.env.local.example` to `.env` for placeholder values.
- `./scripts/aol run lint` only checks required files exist + JSON validity;
  `./scripts/aol run build` imports every module and writes `build/platform-manifest.json`.
  Neither uses ESLint/tsc/a bundler.
- Do **not** reintroduce `npm install` / `package-lock.json` as the primary path; AOL owns
  workspace linking via `RTPSC-package-lock.json` (see `docs/rtpsc-package-lock.md`).
- The scaffold compliance report expects overall `ready_scaffold` until manual legal,
  security, data-governance, and operations sign-offs are recorded. Use
  `--strict-production` only for real cutover gates.
