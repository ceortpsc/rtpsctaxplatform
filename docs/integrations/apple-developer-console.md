# Apple Developer Console · RTPSC

Operator console for **App Store Connect API** automation and Apple Developer Program
setup inside the RTPSC platform.

## Launch

```bash
./scripts/aol install
./rtpsc start apple
# UI: http://127.0.0.1:8870/
# or: pnpm run start:apple
```

Also linked from the shared App Shell under **Administration → Integrations**.

## Required Apple-side steps

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/)
2. Account Holder requests App Store Connect API access  
   (Users and Access → Integrations → App Store Connect API)
3. Generate a team API key and download the `.p8` **once**
4. Note **Issuer ID** and **Key ID**
5. Store secrets outside git (Cursor Personal secrets / approved secret store)

## RTPSC environment

```bash
APPLE_CONNECT_ENABLED=true
APPLE_ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
APPLE_ASC_KEY_ID=ABC123DEFG
APPLE_ASC_PRIVATE_KEY_PATH=./certs/AuthKey_ASC.p8
APPLE_TEAM_ID=TEAMID1234
APPLE_BUNDLE_ID=com.rosstaxsoftware.rtpsc
```

Until secrets are set **and** `APPLE_CONNECT_ENABLED=true`, live Apple API calls stay blocked
(`credentials_not_configured` / gate protected). The console still opens local portals and
shows the setup checklist.

Optional: `APPLE_RETURN_FULL_TOKEN=true` returns the raw JWT from `POST /api/apple/token`
(default returns preview only).

## HTTP API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health |
| GET | `/metadata` | Service metadata + redacted Apple config |
| GET | `/api/apple/status` | Gate, capabilities, portals, setup steps |
| GET | `/api/apple/checklist` | Ordered required setup |
| POST | `/api/apple/token` | Issue ES256 JWT (gated) |
| GET | `/api/apple/apps` | List apps (live when gated open; stub otherwise) |
| GET | `/design-system` | Shared design-system page |

## Packages

- `@rtp/apple-connect` — JWT ES256, gate, fetch helper, capability catalog
- `@rtp/apple-developer-console` — HTTP + App Shell UI on port **8870**

## Security notes

- Never commit `.p8` private keys
- ASC API keys are not interchangeable with APNs keys
- No formal Apple compliance certification is claimed by this scaffold
