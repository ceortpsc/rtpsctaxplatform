# RTPSC-package-lock.json

Canonical platform lockfile for the RTPSC Tax Platform monorepo. Sealed by
**AOL** (Adaptive Optimized Linker) on every `aol install` / `aol lock --write`.

## File

| Property | Value |
|----------|-------|
| Path | `/RTPSC-package-lock.json` |
| Format | `RTPSC-package-lock` |
| Schema version | `2` |
| Generator | `aol@0.1.0` |
| JSON Schema | `tools/aol/RTPSC-package-lock.schema.json` |

Legacy `aol.lock.json` (v1) is still readable for migration and is removed after a
successful v2 seal.

## What it seals

- Every workspace package name → location symlink target
- Per-package **fingerprint** (16-char sha256 prefix of manifest-critical fields)
- Per-package **integrity** (`sha256-<full digest>`) for v2
- Sector map (`packages`, `services`, `workers`, `pipelines`, `engines`, `tools`)
- Platform metadata, engines, copyright / product disclaimer

## Commands

```bash
./scripts/aol install          # link + seal RTPSC-package-lock.json
./scripts/aol lock             # inspect sealed lock
./scripts/aol lock --json      # machine-readable
./scripts/aol lock --write     # force re-seal
./scripts/aol doctor           # validates format + fingerprints
```

## Example package entry

```json
"@rtp/platform-core": {
  "name": "@rtp/platform-core",
  "version": "0.1.0",
  "location": "packages/platform-core",
  "sector": "packages",
  "private": true,
  "link": true,
  "linkTarget": "packages/platform-core",
  "fingerprint": "8ef391896df1e806",
  "integrity": "sha256-…",
  "scripts": ["test"],
  "dependencies": {},
  "devDependencies": {}
}
```

## Relation to npm

`RTPSC-package-lock.json` replaces `package-lock.json` for this monorepo.
Do not commit npm lockfiles; AOL owns workspace linking.

## Intellectual property

Lockfile format strings, schema, and generator metadata are part of the AOL /
RTPSC intellectual-property surface. See `docs/aol-intellectual-property.md`.
