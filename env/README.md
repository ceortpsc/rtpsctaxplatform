# Environment Profiles

Use these example files as templates for environment-specific configuration. Secrets must be supplied through secure environment management and must not be committed.

| File | Profile |
|------|---------|
| `.env.local.example` | Local developer / Cursor agent |
| `.env.dev.example` | Shared development |
| `.env.stage.example` | Staging |
| `.env.prod.example` | Production |

Root template: `/.env.example`.

Cursor Cloud (Personal): set IRS and application secrets in the environment dashboard linked to `ceortpsc/rtpsctaxplatform`. See [`docs/cursor-environment.md`](../docs/cursor-environment.md).
