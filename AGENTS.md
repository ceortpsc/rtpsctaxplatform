# AGENTS.md

## Cursor Cloud specific instructions

This is the **RTPSC Tax Platform Scaffold**: a Node.js (`>=22`) npm-workspaces monorepo of
executable stubs (`services/*`, `workers/*`, `pipelines/*`, `engines/*`, `packages/*`). All code
uses ES modules (`.mjs`) and only Node built-ins — there are **no external npm runtime
dependencies**, so `npm install` just links the workspaces.

### Running services / commands

Standard commands are documented in `README.md` and wired in root `package.json` / `Makefile`.
Use the npm scripts (`npm run lint`, `npm test`, `npm run build`, `npm run start`, `npm run worker:*`).

- `npm run start` launches only the **api-gateway** on port `3000` and blocks (long-running). Start
  it in a background terminal/tmux session. Verify with `curl http://localhost:3000/health` and
  `curl http://localhost:3000/metadata`.
- Other services are independent HTTP stubs on fixed ports: refund-status `3001`, transcript `3002`,
  analytics `3003` (`npm run start:refund-status`, `start:transcript`, `start:analytics`).
- Workers run one-shot and print a JSON descriptor + planned steps, then exit
  (`npm run worker:tds`, `worker:transcript-pull`, `worker:live-source`).
- `npm run start:dashboard` launches the **modules-dashboard** on port `3010`: a read-only module
  catalog UI (`GET /api/modules`). It only lists modules; it does not trigger workflows.
- Workflows run in the **background** via the `workflow-runner` worker, not from any dashboard:
  `npm run start:workflows` (long-running) or `npm run worker:workflows` (one-shot). A single
  workflow can be run from the terminal with `npm run workflow:run <name> '<json>'`.

### Non-obvious notes

- The services only expose `/health` and `/metadata` (any other path returns `404`). There is no
  business logic, DB, or inter-service calls yet — "dependencies" in descriptors are metadata only.
- `docker compose up` (Postgres 16 / Redis 7 in `docker-compose.yml`) is **optional and unused by
  the code**. Do not treat Docker as a prerequisite for running or testing.
- No `.env` is required — `platform-core` defaults every config value to `unset`/sane defaults.
  Optionally copy `env/.env.local.example` to `.env` for placeholder values.
- `npm run lint` only checks required files exist + JSON validity; `npm run build` imports every
  module and writes `build/platform-manifest.json`. Neither uses ESLint/tsc/a bundler.
- The background `workflow-runner` keeps itself alive via a non-unref'd interval timer; its
  scheduled workflow timers are unref'd. Set `WORKFLOW_CYCLE_MS` to change the background cadence.
