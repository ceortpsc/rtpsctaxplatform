# Actual secure tunnel & platform topology configuration

## What was configured

| Layer | Configuration |
|-------|----------------|
| Secure tunnel | Allowlisted HTTPS IRS + Apple endpoints; status `configured` when client + endpoint set |
| Gateways | `api-gateway:3000`, `irs-gateway:8820` |
| Services | Ports 3001–3006, 3010, 8787, 8860, 8870 (see topology) |
| Workers | TDS, transcript-pull, live-source, workflow-runner, ai-persona |
| Pipelines | transmission (transmitter), masterfile, refund-status |
| Transmitter IDs | `EFIN` / `ETIN` / `ERO_PTIN` / `ERO_CAF_NUMBER` env keys |
| Env loader | Gitignored `.env` via `bootstrapEnv()` on service/CLI start |

## Commands

```bash
cp env/.env.local.example .env   # then set secrets locally
./rtpsc config doctor
./rtpsc env
./rtpsc start gateway
./rtpsc start apple              # optional
```

## Fail-safe

Even when the tunnel is **configured**, live IRS transmission stays held until:

1. `APP_ENV=prod` (or `production`)
2. API / TDS / tunnel secrets fully set
3. `APPROVED_TUNNEL_ENDPOINT` allowlisted
4. `EFILE_TRANSMISSION_ENABLED=true`
5. IRS signing keys provisioned for `irs-gateway`

Operator secrets (including any PTIN-linked local unlock) belong only in `.env` or Cursor Personal secrets — never in git.
