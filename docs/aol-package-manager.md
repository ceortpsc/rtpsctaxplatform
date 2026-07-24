# AOL — Adaptive Optimized Linker

A first-party package manager for the RTPSC Tax Platform monorepo. Built to replace
`npm` for workspace linking and script running with a parallel fast path and a
modernized Instant Messenger aesthetic.

## Why AOL exists

npm is general-purpose and heavy. This monorepo is workspace-local (no external
runtime dependencies). AOL is purpose-built for that graph:

- **Parallel linking** — all workspace symlinks created concurrently
- **Fingerprint lockfile** — `RTPSC-package-lock.json` seals the constellation
- **Cache hits** — healthy links + matching fingerprints → near-instant install
- **Direct script exec** — no npm process tax for `run` / `exec`
- **Signal UI** — "You've got packages." Buddy-list workspaces. Quantum handshake.

Target: **≥20× faster** than `npm install` on this scaffold (often much more on
warm/cache-hit paths).

## Commands

```bash
./scripts/aol install          # dial / handshake aliases work too
./scripts/aol run lint
./scripts/aol run test
./scripts/aol run build
./scripts/aol run start
./scripts/aol run -w @rtp/api-gateway start
./scripts/aol ls               # buddy list
./scripts/aol graph | mail | lock   # constellation / status / RTPSC lock
./scripts/aol config list
./scripts/aol codes | api | copyright | doctor
./scripts/aol bench
./scripts/aol commands
./scripts/aol help
```

Full concept catalog, codes, config, and programmatic API:
[`aol-api-and-config.md`](./aol-api-and-config.md) · IP: [`aol-intellectual-property.md`](./aol-intellectual-property.md) · Lockfile: [`rtpsc-package-lock.md`](./rtpsc-package-lock.md)

Root `package.json` scripts delegate to AOL so `aol run <script>` and the
Makefile stay aligned.

## Aesthetic

Next-level Instant Messenger soul:

| Motif | Classic AOL | AOL PM |
|-------|-------------|--------|
| Greeting | You've Got Mail | You've got packages |
| Roster | Buddy List | Workspace Buddy List |
| Connect | Dial-up handshake | Quantum handshake bar |
| Mark | Yellow triangle | Amber signal chevron ▲ |
| Palette | Blue / yellow | Deep navy · electric cyan · signal amber |

No cream-serif luxury theme. This is signal tech — fast, luminous, unmistakable.

## Architecture

```text
tools/aol/
  bin/aol.mjs          CLI entry
  src/
    ansi.mjs           truecolor signal palette
    ui.mjs             panels, buddy list, handshake
    workspaces.mjs     glob discovery from package.json
    lockfile.mjs       RTPSC-package-lock.json (v2) + legacy aol.lock.json reader
    install.mjs        parallel linker + cache path
    run.mjs            script / exec runner
    bench.mjs          npm comparison harness
    cli.mjs            command router
    index.mjs          public API
```

## Compliance note

AOL only links local workspaces declared in root `package.json`. It does not
fetch from external registries or implement unauthorized network access. Registry
fetching is intentionally out of scope for this scaffold.
