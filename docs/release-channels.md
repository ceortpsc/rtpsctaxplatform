# RTPSC 02.0V release channels

> **Note:** `main` also ships a governed publication registry at `config/release-channels.json` with CLI `scripts/release-channel.mjs` and docs in `docs/releases/v2.0-release-channels.md`. Runtime channel selection in this branch uses `packages/platform-core/src/release-channels.mjs` + `./rtpsc release`. These parallel systems need a single SoT decision (see merge conflict report).


Ross Tax Pro Software Co **02.0V** ships on eight explicit release channels:

| Tag | Meaning |
|---|---|
| `v2.0-alpha` | Early unstable build |
| `v2.0-beta` | Feature-complete but not final |
| `v2.0-rc1` | Release candidate |
| `v2.0-stable` | Final production build |
| `v2.0-lts` | Long-term support |
| `v2.0-enterprise` | Enterprise-grade build (default) |
| `v2.0-dev` | Developer build |
| `v2.0-hotfix` | Emergency patch |

## Commands

```bash
./rtpsc release list
./rtpsc release describe enterprise
./rtpsc release build all
./rtpsc release activate enterprise
./rtpsc release status
./rtpsc release path dev
```

Environment override:

```bash
export RTP_RELEASE_CHANNEL=v2.0-enterprise
export APP_ENV=production
./rtpsc deploy
```

Artifacts land under `build/releases/<tag>/manifest.json` and `build/active-release.json`.

Only **productionReady** channels (`stable`, `lts`, `enterprise`, `hotfix`) may activate under `APP_ENV=production` without `--force`. Channel selection never bypasses environment protection for e-file transmission.
