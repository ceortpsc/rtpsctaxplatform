# ROSS.CO — Infinite Transfer Rate Package Manager

Full prototype for the RTPSC package-velocity product line.

## Product identity

| Field | Value |
|-------|-------|
| Brand | **ROSS.CO** |
| Expansion | Infinite Transfer Rate Package Manager |
| Acronym | ITR |
| Glyph | ◈ |
| Tagline | Transfer without ceiling. |
| Domain | `ross.co` |
| Delegate linker | AOL (Adaptive Optimized Linker) |

ROSS.CO does **not** replace AOL’s workspace linker. It adds the product lifecycle, transfer-rate reporting, registration, copyright seal, online presence, and SEO emit layer on top of AOL’s parallel install.

## Lifecycle map

```text
map → plan → scope → stage → test → validate → verify → register → presence → seo
```

| Stage | Command | Outcome |
|-------|---------|---------|
| map | `rossco lifecycle` | Engineering constellation map |
| plan | `rossco plan` | Velocity targets + release goals |
| scope | `rossco scope` | In-scope / deferred boundaries |
| stage | `rossco stage` | Staging freeze artifact |
| test | `rossco test` | Node test runner for ITR + ROI |
| validate | `rossco validate` | Schema/path/config gates |
| verify | `rossco verify` | Repro install + transfer sample |
| register | `rossco register` | `build/rossco-registry.json` |
| presence | `rossco presence` | `presence/rossco` landing |
| seo | `rossco seo` | robots, sitemap, JSON-LD |

## CLI

```bash
./scripts/rossco install          # infinite transfer (AOL-backed)
./scripts/rossco transfer --json
./scripts/rossco lifecycle
./scripts/rossco plan
./scripts/rossco scope
./scripts/rossco stage
./scripts/rossco test
./scripts/rossco validate
./scripts/rossco verify
./scripts/rossco register
./scripts/rossco copyright
./scripts/rossco presence
./scripts/rossco seo
./scripts/rossco doctor
```

Aliases: `node ./tools/rossco/bin/rossco.mjs`, `itr` bin name in package metadata.

## Infinite Transfer Rate

- No ROSS.CO-side throttle on parallel workspace linking
- Wall-clock remains filesystem/linker bound
- Reports estimated Mbps + elapsed ms for velocity dashboards
- Lock sealing remains `RTPSC-package-lock.json` via AOL

## Online presence & SEO

Generated under `presence/rossco/`:

- `index.html` — brand-first landing
- `styles.css`
- `robots.txt`
- `sitemap.xml`
- `structured-data.json` — Schema.org `SoftwareApplication`

## Engineering volumes

1. Mapping & planning (`lifecycle`, `plan`, `scope`)
2. Staging & verification (`stage`, `test`, `validate`, `verify`)
3. Registration & IP (`register`, `copyright` — see `rossco-intellectual-property.md`)
4. Presence & SEO (`presence`, `seo`)

## Compliance

- Local workspace linking only (no external registry fetch in this scaffold)
- Secrets never embedded in ROSS.CO transfer path
- Copyright notices in `tools/rossco/NOTICE` + root `LICENSE`
