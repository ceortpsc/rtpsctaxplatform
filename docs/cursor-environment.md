# Cursor Cloud Environment — RTPSC

## Repository mapping

- Environment name: `ceortpsc/rtpsctaxplatform` (Personal)
- Repository: `github.com/ceortpsc/rtpsctaxplatform`
- Repo-file config: `.cursor/environment.json` (highest priority when present)
- Access control: **Personal Only** — configure in Cursor → Settings → Environment → Access Control

## What Cursor detects

| Artifact | Path |
|----------|------|
| Environment definition | `.cursor/environment.json` |
| Agent Dockerfile | `.cursor/Dockerfile` |
| Deploy Dockerfile | `Dockerfile` |
| Node workspace | `package.json` + AOL lockfile |
| Python tooling | `requirements.txt` |
| Compose (optional local deps) | `docker-compose.yml` |

## Secrets (Personal environment only)

Set these in the Cursor dashboard secrets UI — **never commit values**:

- `IRS_CLIENT_ID_PRIMARY`, `IRS_CLIENT_SECRET_PRIMARY`, `IRS_PRIVATE_KEY_PATH_PRIMARY`
- `IRS_CLIENT_ID_SECONDARY`, `IRS_CLIENT_SECRET_SECONDARY`, `IRS_PRIVATE_KEY_PATH_SECONDARY`
- `IRS_CLIENT_ID`, `IRS_KEY_ID`, `IRS_PRIVATE_KEY_PATH`, `IRS_TOKEN_URL`, `IRS_SCOPE`
- `SBTPG_CLIENT_ID`, `SBTPG_CLIENT_SECRET`
- `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`

Use `.env.example` and `env/.env.*.example` as templates. Mount private keys under `./certs/` (gitignored).

## Service map (scaffold)

| Logical name | Workspace path | Port |
|--------------|----------------|------|
| api | `services/api-gateway` | 3000 |
| irs-gateway | `services/irs-gateway` | 8820 |
| refund-status | `services/refund-status-service` | 3001 |
| transcript | `services/transcript-service` | 3002 |
| analytics | `services/analytics-service` | 3003 |
| worker | `workers/*` | n/a (one-shot / long-running) |

Node engines: `>=22`. Package manager: **AOL** (`./scripts/aol`), not npm as the primary install path.

## Cloud helpers (tmux / desktop / recordScreen)

Custom `.cursor/Dockerfile` images must install platform helpers themselves:

| Package | Why |
|---------|-----|
| `tmux` | `environment.json` `terminals` + Cursor `configure-terminals` |
| `ffmpeg` | `recordScreen` / demo artifacts |
| `sudo` | Cursor Dockerfile guidance |
| `locales` + `xz-utils` | computer-use / remote-desktop bootstrap on Ubuntu |

Diagnose:

```bash
./rtpsc cloud doctor
./rtpsc cloud doctor --json
# or: pnpm run cloud:doctor
```

Notes:

- `Desktop init script not found, exiting` is Cursor’s **platform** desktop bootstrap
  (computer-use / noVNC), not a missing repo script. Shipping `locales`/`xz-utils`/`sudo`
  in `.cursor/Dockerfile` is the supported fix for custom Ubuntu images.
- After Dockerfile changes, force a Cloud environment rebuild (Dockerfile comment bump or
  delete the saved environment in Cursor → Cloud Agents → Environments). Snapshots can
  keep an old image until invalidated.

## Branding

- Terminal MOTD: `assets/banners/primeweb-motd.txt`
- SVG banner: `assets/banners/primeweb-banner.svg`
