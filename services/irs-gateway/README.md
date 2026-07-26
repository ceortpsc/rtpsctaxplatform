# IRS Gateway

Deterministic OAuth2 / TDS token gateway scaffold for approved IRS integrations.

## Endpoints

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness |
| `GET /metadata` | Descriptor + redacted runtime config |
| `POST /irs/token` | Client-credentials token via JWT client assertion |

Default port: `8820`.

## Required environment

Prefer primary-suffixed keys; unsuffixed aliases are accepted as fallback:

- `IRS_TOKEN_URL` (default `https://api.irs.gov/oauth2/v1/token`)
- `IRS_SCOPE` (default `tds`)
- `IRS_CLIENT_ID_PRIMARY` / `IRS_CLIENT_ID`
- `IRS_CLIENT_SECRET_PRIMARY` (optional when assertion-only)
- `IRS_KEY_ID_PRIMARY` / `IRS_KEY_ID`
- `IRS_PRIVATE_KEY_PATH_PRIMARY` / `IRS_PRIVATE_KEY_PATH`

Private keys must live outside git (for example `./certs/`, which is ignored).

## Run

```bash
./scripts/aol run start:irs-gateway
curl -s http://localhost:8820/health
curl -s -X POST http://localhost:8820/irs/token
```

Token requests only reach the IRS when credentials and a readable private key are provisioned. Without them the endpoint returns a structured `credentials_not_configured` response so local scaffold runs stay deterministic.
