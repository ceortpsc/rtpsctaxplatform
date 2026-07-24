# Agent Build Engineering Team

`@rtp/agent-build-team` is the RTPSC **Agent Build Engineering Team** — a
dependency-free, multi-role orchestrator that covers **all developmental
projects and modules** in the monorepo (packages, services, workers, pipelines,
engines, and tools).

## Roles

| Role | Focus |
|------|--------|
| Platform Architect | Topology, sectors, dependency shape |
| Build Engineer | Entrypoints, ESM package metadata, build readiness |
| QA Engineer | Scripts and quality-gate surface |
| Compliance Officer | No scraping, env-only secrets, stub gates |
| Docs Steward | README / operator docs coverage |
| Release Lead | Roll-up readiness verdict per module |

## Commands

```bash
./scripts/aol run team                 # full team run + lint/test/build gates
./scripts/aol run team:inventory       # discover every module
./scripts/aol run team:roles           # list roster
./scripts/aol run team:plan            # coverage plan

# or directly:
node ./packages/agent-build-team/bin/abet.mjs run --verbose
node ./packages/agent-build-team/bin/abet.mjs inventory --json
node ./packages/agent-build-team/bin/abet.mjs run --skip-gates
```

A JSON report is written to `build/agent-build-team-report.json` on every `run`.

## Design constraints

- Node.js built-ins only (no external runtime dependencies)
- ES modules throughout
- Compliance boundaries stay explicit (no scraping, no embedded secrets)
- Works with AOL (`./scripts/aol`) as the primary package manager
