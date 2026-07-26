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
`docs/production-compliance-report.md`.

Concept extras: `aol commands`, `aol config`, `aol codes`, `aol api`,
`aol copyright`, `aol doctor`, `aol graph`, `aol mail`, `aol whoami`.

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

- `./scripts/aol run start` launches only the **api-gateway** on port `3000` and blocks
  (long-running). Start it in a background terminal/tmux session. Verify with
  `curl http://localhost:3000/health` and `curl http://localhost:3000/metadata`.
- Other services are independent HTTP stubs on fixed ports: refund-status `3001`,
  transcript `3002`, analytics `3003`, irs-gateway `8820`
  (`./scripts/aol run start:refund-status`, `start:transcript`, `start:analytics`,
  `start:irs-gateway`).
- Workers run one-shot and print a JSON descriptor + planned steps, then exit
  (`./scripts/aol run worker:tds`, `worker:transcript-pull`, `worker:live-source`).
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