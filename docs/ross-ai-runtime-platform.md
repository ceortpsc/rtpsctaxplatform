# Ross AI Runtime Platform

Command package toolkit and **operator control plane** for **Ross Tax Software** —
init, doctor, local runtime, `.rpkg` packaging, multi-target deploy plans, access
gates, dashboards, module inventory, hardening, and WebSockets. Python 3 **stdlib
only** (no required pip dependencies).

## Quickstart (no Docker)

```bash
python3 ross.py init
python3 ross.py doctor
python3 ross.py dev
```

Open: http://127.0.0.1:8787

1. Landing page → **Create access** (`/signup`) or **Sign in** (`/signin`)
2. Operator console → `/dashboard`
3. Modules / engines / systems / infrastructure / packages / deploy / runtime

## Example commands

```bash
python ross.py init
python ross.py doctor
python ross.py package build
python ross.py runtime run hello
python ross.py deploy plan docker
python ross.py dev
```

## Operator console surface

| Path | Purpose |
|------|---------|
| `/` | Brand landing |
| `/signup` `/signin` `/login` | Access gates |
| `/dashboard` | Live control plane + WS feed |
| `/modules` | Full constellation inventory |
| `/engines` | Intelligence engines |
| `/systems` | Services, workers, pipelines |
| `/infrastructure` | Foundation + hardening posture |
| `/packages` `/deploy` `/runtime` | Artifacts, plans, scripts |
| `/ws` | WebSocket live event channel |
| `/health` `/metadata` | Probe endpoints |
| `/api/inventory` `/api/hardening` `/api/events` | Auth JSON APIs |

## Hardening

- PBKDF2-SHA256 passwords (210k iterations)
- HttpOnly + SameSite session cookies (Secure behind TLS / `X-Forwarded-Proto`)
- CSRF on logout
- CSP / X-Frame-Options / nosniff / COOP / CORP
- Per-IP sliding-window rate limits
- Audit log for signup / login / logout

## Docker

```bash
cp .env.example .env
docker compose -f docker-compose.ross.yml up --build
```

## Layout

```text
ross.py                 CLI entry
ross_ai/
  auth.py               signup / sign-in / sessions
  hardening.py          headers + rate limits
  inventory.py          monorepo module map
  websocket.py          RFC6455 framing
  platform_server.py    HTTP + WS control plane
  web/static/           CSS / JS
  web/pages.py          landing, gates, dashboards
workspace/data/         control-plane JSON store (gitignored)
```
