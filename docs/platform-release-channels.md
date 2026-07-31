# RTPSC v2.0 release channels

Platform builds are tagged on a fixed **2.0.0** base with named channels:

| Channel | Tag | Meaning | Production eligible |
|---------|-----|---------|---------------------|
| `alpha` | `v2.0-alpha` | Early unstable build | no |
| `beta` | `v2.0-beta` | Feature-complete but not final | no |
| `rc1` | `v2.0-rc1` | Release candidate | no |
| `stable` | `v2.0-stable` | Final production build | yes |
| `lts` | `v2.0-lts` | Long-term support | yes |
| `enterprise` | `v2.0-enterprise` | Enterprise-grade build | yes |
| `dev` | `v2.0-dev` | Developer build (default) | no |
| `hotfix` | `v2.0-hotfix` | Emergency patch | yes |

Canonical catalog: [`config/release/channels.json`](../config/release/channels.json).  
Package: [`packages/platform-version`](../packages/platform-version).

## Operator commands

```bash
./rtpsc release list
./rtpsc release status
./rtpsc release set beta
./rtpsc release stamp stable --note "cut for prod"
./rtpsc release develop          # stamp every channel → build/release-matrix.json
./rtpsc release tag enterprise
./rtpsc version
```

Equivalent: `make release`, `make release-list`, `make release-stamp CHANNEL=stable`, `pnpm run release`.

## Resolution order

1. Explicit CLI / API override (`channel`, `version`)
2. `RTPSC_RELEASE_CHANNEL` / `RTPSC_VERSION` env
3. Stamped `build/platform-release.json`
4. Default: `v2.0-dev` on `2.0.0`

## Build & deploy

- `./rtpsc build` stamps the active channel into `build/platform-release.json` and embeds `release` on `build/platform-manifest.json`.
- Full deploy manifests include the same `release` block.
- HTTP services expose `release` on `GET /metadata` (and a short tag block on `/health` for services using `startHttpService`).

## Environment

```bash
export RTPSC_RELEASE_CHANNEL=stable   # or v2.0-stable
export RTPSC_VERSION=2.0.0            # optional semver override
```
