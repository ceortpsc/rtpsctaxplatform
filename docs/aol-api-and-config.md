# AOL API, Commands, Codes & Configuration

Companion to [`aol-package-manager.md`](./aol-package-manager.md) and
[`aol-intellectual-property.md`](./aol-intellectual-property.md).

## Concept commands

| Command | Aliases | Concept |
|---------|---------|---------|
| `install` | `i`, `link`, `dial`, `handshake` | Quantum handshake — parallel link |
| `run` | | Transmit a script signal |
| `exec` | | Raw workspace channel |
| `ls` | `list`, `buddy`, `buddies` | Workspace Buddy List |
| `why` | | Explain a buddy link |
| `graph` | `constellation`, `map` | Constellation map |
| `mail` | `signal`, `status` | You've got status |
| `bench` | `velocity`, `speed` | Velocity vs npm |
| `config` | `cfg` | `list` / `get` / `set` / `init` |
| `codes` | `signals` | Signal + exit code registry |
| `api` | | Programmatic API surface |
| `commands` | `concepts` | Full concept catalog |
| `copyright` | `ip`, `license`, `notice` | IP notices |
| `whoami` | `brand` | Product identity |
| `doctor` | `diag`, `health` | Diagnostics |
| `help` / `version` | | Meta |

```bash
./scripts/aol commands
./scripts/aol help dial
./scripts/aol mail --json
```

## Signal codes

Exit codes: `0` OK · `1` ERROR · `2` USAGE · `3` CONFIG · `4` LOCK · `5` WORKSPACE ·
`6` SCRIPT · `7` IO · `8` IP · `9` DOCTOR

Examples: `AOL-G001` unknown command · `AOL-C002` config invalid · `AOL-W001`
workspace not found · `AOL-L002` stale lock fingerprints.

```bash
./scripts/aol codes --json
```

## Configuration

File: `aol.config.json` (schema: `tools/aol/aol.config.schema.json`)
Lockfile: `RTPSC-package-lock.json` (schema: `tools/aol/RTPSC-package-lock.schema.json`)

```bash
./scripts/aol config init
./scripts/aol config list
./scripts/aol lock
./scripts/aol lock --write
./scripts/aol config get brand.tagline
./scripts/aol config set ui.quiet true
```

Env overlays: `AOL_NO_COLOR`, `AOL_QUIET`, `AOL_FORCE`, `AOL_BENCH_ROUNDS`, `AOL_DEBUG`.

## Programmatic API

```js
import { createAol } from '@rtp/aol';

const aol = await createAol({ root: process.cwd() });
await aol.install({ force: true });
const buddies = await aol.listWorkspaces();
const report = await aol.doctor();
console.log(aol.copyright());
```

Also exported: `ExitCode`, `SignalCode`, `AolError`, `IP`, `COMMANDS`,
`loadConfig`, `doctor`, `graph`, `describeApiSurface`, …

```bash
./scripts/aol api --json
```
