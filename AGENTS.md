# AGENTS.md

## Cursor Cloud specific instructions

This is the **RTPSC Tax Platform Scaffold**: a Node.js (`>=22`) monorepo of executable
stubs (`services/*`, `workers/*`, `pipelines/*`, `engines/*`, `packages/*`). All code uses
ES modules (`.mjs`) and only Node built-ins — there are **no external runtime
dependencies**.

### Package manager: AOL

Use **AOL** (Adaptive Optimized Linker) instead of npm:

```bash
./scripts/aol install          # parallel workspace link + aol.lock.json
./scripts/aol run lint
./scripts/aol run test
./scripts/aol run build
./scripts/aol run start
./scripts/aol run worker:tds
./scripts/aol bench            # compare install speed vs npm
```

Equivalent: `node ./tools/aol/bin/aol.mjs <cmd>` or `make setup|lint|test|build|start|bench`.

Docs: `docs/aol-package-manager.md`, `docs/aol-api-and-config.md`,
`docs/aol-intellectual-property.md`.

Concept extras: `aol commands`, `aol config`, `aol codes`, `aol api`,
`aol copyright`, `aol doctor`, `aol graph`, `aol mail`, `aol whoami`.

### Running services / commands

- `./scripts/aol run start` launches only the **api-gateway** on port `3000` and blocks
  (long-running). Start it in a background terminal/tmux session. Verify with
  `curl http://localhost:3000/health` and `curl http://localhost:3000/metadata`.
- Other services are independent HTTP stubs on fixed ports: refund-status `3001`,
  transcript `3002`, analytics `3003`
  (`./scripts/aol run start:refund-status`, `start:transcript`, `start:analytics`).
- Workers run one-shot and print a JSON descriptor + planned steps, then exit
  (`./scripts/aol run worker:tds`, `worker:transcript-pull`, `worker:live-source`).

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
  workspace linking via `aol.lock.json`.
