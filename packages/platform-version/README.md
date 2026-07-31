# `@rtp/platform-version`

RTPSC **v2.0 release channels** — tags, stamps, and metadata for platform builds.

## Channels

| Channel | Tag | Meaning |
|---------|-----|---------|
| `alpha` | `v2.0-alpha` | Early unstable build |
| `beta` | `v2.0-beta` | Feature-complete but not final |
| `rc1` | `v2.0-rc1` | Release candidate |
| `stable` | `v2.0-stable` | Final production build |
| `lts` | `v2.0-lts` | Long-term support |
| `enterprise` | `v2.0-enterprise` | Enterprise-grade build |
| `dev` | `v2.0-dev` | Developer build (default) |
| `hotfix` | `v2.0-hotfix` | Emergency patch |

Catalog: `config/release/channels.json`.

## CLI

```bash
./rtpsc release list
./rtpsc release status
./rtpsc release set beta
./rtpsc release stamp stable --note "cut for prod"
./rtpsc release tag enterprise
./rtpsc version
```

Env overrides: `RTPSC_RELEASE_CHANNEL`, `RTPSC_VERSION`.

## Stamp artifact

`./rtpsc release stamp` writes:

- `build/platform-release.json`
- `build/platform-release.sha256`
- `build/platform-release-LATEST.json`

Services expose the active release on `GET /metadata` as `release`.
