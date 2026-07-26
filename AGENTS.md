# AGENTS.md

## Cursor Cloud specific instructions

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

### Cursor Cloud environment

- Repo definition: `.cursor/environment.json` (+ `.cursor/Dockerfile`).
- Linked repository: `ceortpsc/rtpsctaxplatform` (Personal scope).
- Env templates: `.env.example`, `env/.env.*.example`. Set real IRS secrets only in the
  Cursor Personal environment / approved secret store — never commit them.
- Details: `docs/cursor-environment.md`. Banner: `assets/banners/primeweb-motd.txt`.

### Running services / commands

- `./scripts/aol run start` launches only the **api-gateway** on port `3000` and blocks
  (long-running). Start it in a background terminal/tmux session. Verify with
  `curl http://localhost:3000/health` and `curl http://localhost:3000/metadata`.
- Other services are independent HTTP stubs on fixed ports: refund-status `3001`,
  transcript `3002`, analytics `3003`, irs-gateway `8820`, ai-workforce-hub `8860`
  (`./scripts/aol run start:refund-status`, `start:transcript`, `start:analytics`,
  `start:irs-gateway`, `start:ai-workforce`).
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