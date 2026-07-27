# ROSS.CO Infinite — Platform Integration

Production-candidate package manager, task graph, registry, transfer engine, MCP server, and SEO ownership control plane integrated into the RTPSC monorepo as `@rtp/ross-infinite`.

## Commands

```bash
./scripts/ross-infinite doctor
./scripts/ross-infinite hash <file>
./scripts/ross-infinite transfer <src> <dest>
./scripts/ross-infinite resolve
./scripts/ross-infinite plan default
./scripts/ross-infinite run default --jobs 4 --capture
./scripts/ross-infinite seo plan config/seo/ross.co.ownership.json
./scripts/ross-infinite seo generate config/seo/ross.co.ownership.json
./scripts/ross-infinite seo prevalidate config/seo/ross.co.ownership.json
./scripts/ross-infinite seo google config/seo/ross.co.ownership.json listSites
./scripts/ross-infinite seo indexnow config/seo/ross.co.ownership.json

pnpm run ross-infinite:test
pnpm run ross-infinite:smoke
pnpm run ross-infinite:verify
```

Equivalent: `node ./tools/ross-infinite/bin/ross.mjs`, `make ross-infinite ARGS='doctor'`.

## Ownership assertion

Configured in `config/seo/ross.co.ownership.json` (mirrored under `tools/ross-infinite/config/seo/`):

- Legal name: ROSS.CO
- Owner: Condre Dvon Ross
- Asserted: 2026-07-26

Internal assertion is distinct from provider verification. Google/Bing remain pending until DNS/meta tokens are deployed and confirmed.

## Evidence states

`ASSERTED → PREVALIDATED → DEPLOYED → PROVIDER_VERIFIED → INDEXING_ENABLED → INDEXED`

Receipts write under `release-evidence/seo/` with SHA-256 sidecars.

## Agent

`seo-ownership-agent` is registered on the deployment-assist team:

```bash
./rtpsc agents run seo-ownership-prevalidate
```

## Important controls

“Infinite Transfer Rate” means adaptive, parallel, resumable, cache-aware, deduplicated transfer that can approach available capacity. It is **not** a claim of physically unlimited bandwidth. Live cloud deployment, trademark/copyright/patent filings, and provider Search Console verification are not claimed as completed by this scaffold.
