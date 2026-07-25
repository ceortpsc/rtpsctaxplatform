# AGENTS.md

## Cursor Cloud specific instructions

This is the **RTPSC Tax Platform Scaffold**: a Node.js (`>=22`) monorepo of executable
stubs (`services/*`, `workers/*`, `pipelines/*`, `engines/*`, `packages/*`). All code uses
ES modules (`.mjs`) and only Node built-ins — there are **no external runtime
dependencies**.

### Package manager: AOL

Use **AOL** (Adaptive Optimized Linker) instead of npm:

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

Equivalent: `node ./tools/aol/bin/aol.mjs <cmd>` or `make setup|lint|test|build|start|bench|compliance`.

Docs: `docs/aol-package-manager.md`, `docs/aol-api-and-config.md`,
`docs/aol-intellectual-property.md`, `docs/live-production-checklist.md`,
`docs/enterprise-tax-software-checklist.md`, `docs/production-compliance-report.md`.

Concept extras: `aol commands`, `aol config`, `aol codes`, `aol api`,
`aol copyright`, `aol doctor`, `aol graph`, `aol mail`, `aol whoami`.

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
- Production compliance: `./scripts/aol run compliance:checklist`,
  `./scripts/aol run compliance -- --skip-gates`,
  `./scripts/aol run compliance -- --live`,
  `./scripts/aol run compliance:log`.
  Artifacts: `build/production-compliance-report.json`,
  `build/production-compliance-report.md`,
  `build/production-compliance-checklist.log`.

### Non-obvious notes

- The services only expose `/health` and `/metadata` (any other path returns `404`).
  There is no business logic, DB, or inter-service calls yet — "dependencies" in
  descriptors are metadata only.
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