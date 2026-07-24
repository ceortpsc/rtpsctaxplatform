# AOL Intellectual Property

**Product:** AOL — Adaptive Optimized Linker  
**Copyright:** © 2026 RTPSC / Ross Tax Software  
**License:** MIT (`LICENSE`)  
**Notice:** `tools/aol/NOTICE`  
**Contact:** ceo@rosstaxsoftware.com

## What is protected

| Asset | Kind | Notes |
|-------|------|-------|
| Source under `tools/aol/` | Copyright | Original software |
| `aol.lock.json` format | Copyright | Lockfile schema/generator strings |
| `aol.config.json` + schema | Copyright | Configuration model |
| Signal codes (`AOL-G###`, …) | Copyright | Diagnostics vocabulary |
| Concept command catalog | Copyright | Command names, aliases, semantics |
| Programmatic API (`createAol`) | Copyright | Public API surface |
| CLI trade dress (▲, buddy list, handshake) | Copyright / trade dress | Original presentation |
| Tagline *You've got packages.* | Copyright | Original product tagline |
| Docs (`docs/aol-*.md`) | Copyright | Original documentation |

## Affiliation disclaimer (critical)

**AOL** in this repository expands only to **Adaptive Optimized Linker**.

This project is **not** affiliated with, endorsed by, sponsored by, or related to
America Online, AOL LLC, Yahoo, or any similarly named consumer online service.
Any Instant Messenger–era aesthetic is conceptual homage only.

## License grant

Unless a file states otherwise, AOL PM source and docs are licensed under the
MIT License in the repository root `LICENSE` file. Redistribution must retain
copyright and permission notices.

## Marks in use

- **AOL** — product acronym for Adaptive Optimized Linker
- **Adaptive Optimized Linker** — full product name
- **You've got packages.** — product tagline
- **▲** — signal chevron brand mark in CLI output

## Enforcement posture

Unauthorized removal of copyright notices, false claims of affiliation with
third-party "AOL" consumer brands, or trademark misuse of *Adaptive Optimized
Linker* within forks distributed as official RTPSC tooling may be pursued under
applicable law. MIT license permissions still apply to the licensed code.

## Machine-readable

```bash
./scripts/aol copyright --json
./scripts/aol whoami
./scripts/aol codes --json
./scripts/aol api --json
```
