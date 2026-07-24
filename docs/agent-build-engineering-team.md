# Agent Build Engineering Team

## Purpose

The **Agent Build Engineering Team** (`@rtp/agent-build-team`, CLI `abet`) is the
platform's multi-role build orchestration layer. It inventories every
developmental project and module, runs specialized engineering agents against
each one, optionally executes lint/test/build quality gates, and emits a
consolidated readiness report.

## Coverage

Sectors in scope:

- `packages/`
- `services/`
- `workers/`
- `pipelines/`
- `engines/`
- `tools/`

## Team roster

1. **Platform Architect** — sector topology and dependency shape
2. **Build Engineer** — entrypoints and ESM package readiness
3. **QA Engineer** — scripts / quality-gate surface
4. **Compliance Officer** — no scraping, env-only secrets, stub gates
5. **Docs Steward** — README coverage
6. **Design Style & Presentation** — brand signals, presentation surfaces, anti-default visual looks
7. **Release Lead** — roll-up ship/build verdict

## Usage

```bash
./scripts/aol install
./scripts/aol run team:inventory
./scripts/aol run team:plan
./scripts/aol run team                 # assessment + lint/test/build
./scripts/aol run team -- --skip-gates # assessment only
```

JSON artifact: `build/agent-build-team-report.json`.

## Integration

- Root scripts: `team`, `team:inventory`, `team:roles`, `team:plan`
- Build manifest imports `@rtp/agent-build-team`
- Lint requires `docs/agent-build-engineering-team.md`
- Cursor Cloud notes live in `AGENTS.md`

## Compliance

The team never introduces scraping flows or embedded secrets. Compliance Officer
findings are blockers when scraping language or hardcoded-secret hints appear in
module metadata.

## Design style & presentation

The Design Style & Presentation agent reviews operator-facing README polish and
any `public/` UI surfaces. It requires clear headings, encourages brand signals,
expects CSS variables on presentation stylesheets, and warns on banned default
AI looks (purple/indigo gradients, cream+terracotta, generic system fonts, glow
stacks).
