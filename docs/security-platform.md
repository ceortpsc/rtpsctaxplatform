# RTPSC Security Platform

Operator and platform security measures for the Ross Tax Pro Software Co
Efile Transmission Software scaffold.

## Packages

| Package | Role |
| --- | --- |
| `@rtp/security-core` | HMAC bearer tokens, AES-256-GCM field encryption, security headers, rate limits, audit JSONL |
| `@rtp/secrets-config` | Secret group catalog + redacted readiness (`api`, `tds`, `tunnel`, `session`, `encryption`, `sbtpg`, `irs`, `tls`) |
| `@rtp/secure-tunnel` | Fail-safe tunnel gate + approved adapter (**status stays `stub` until BND-005**) |
| `@rtp/client-identity` | API/TDS client issuance, hashed secrets, scoped auth |
| `@rtp/platform-core` | Environment protection gate + baseline HTTP security headers |

## Services & workers

| Component | Port / mode | Role |
| --- | --- | --- |
| `security-status-service` | `3007` | `/api/security/status\|secrets\|tunnel\|audit` |
| `api-gateway` | `3000` | Client auth, HMAC token mint/introspect, rate-limited auth, security metadata |
| `security-scanner-worker` | one-shot | Writes `build/security-posture-report.json` |

## CLI

```bash
./rtpsc security status
./rtpsc security secrets
./rtpsc security tunnel
./rtpsc security doctor
./rtpsc security scan
./rtpsc security mint-demo          # requires SESSION_SECRET
./rtpsc security encrypt "payload"  # requires ENCRYPTION_KEY
./rtpsc start security              # :3007
./rtpsc worker:security
```

## Environment keys

Provision via approved secret store / Cursor Personal env — never commit real values.

- `SESSION_SECRET` or `JWT_SECRET` — HMAC access tokens
- `ENCRYPTION_KEY` — AES-256-GCM (32-byte raw, 64-hex, base64, or derived)
- `API_CLIENT_*` / `TDS_CLIENT_*` / `TUNNEL_CLIENT_*`
- `APPROVED_TUNNEL_ENDPOINT` — must be `https://…`
- `TLS_CERT_PATH` / `TLS_KEY_PATH` — optional local TLS material checks
- `SBTPG_*` / `IRS_*` — bank/IRS integrations (still gated / stubbed)

## Fail-closed rules

1. Token minting fails closed when session secrets are unset (gateway may emit a local opaque demo token with a warning).
2. Field encryption/decryption fails closed without `ENCRYPTION_KEY`.
3. E-file transmission stays blocked unless environment protection passes.
4. SBTPG funding stays blocked unless the payment gate passes.
5. Secure tunnel **live transport** remains `stub` until BND-005 security review sign-off.

## Compliance IDs

Automated: `SEC-001` … `SEC-005`, plus existing `BND-*`, `CFG-*`, `EFL-*`.
Manual: `BND-005` (security review), `CFG-004` (secret manager provisioning).

```bash
./scripts/aol run compliance -- --skip-gates
```
