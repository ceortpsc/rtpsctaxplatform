# ROSS.CO SEO Ownership Runbook

## Purpose

Operate the SEO Ownership Agent for ross.co property mapping, ownership prevalidation, Search Console planning, and IndexNow readiness.

## Preconditions

1. Ownership config present at `config/seo/ross.co.ownership.json`
2. Node.js >= 22
3. Optional provider tokens in environment (never committed)

## Procedure

1. Plan

```bash
./scripts/ross-infinite seo plan config/seo/ross.co.ownership.json --json
```

2. Generate assets

```bash
./scripts/ross-infinite seo generate config/seo/ross.co.ownership.json
```

3. Local prevalidate

```bash
./scripts/ross-infinite seo prevalidate config/seo/ross.co.ownership.json
```

4. Deploy `seo/generated/public/` assets and DNS TXT verification record.

5. Live DNS check

```bash
./scripts/ross-infinite seo prevalidate config/seo/ross.co.ownership.json --live
```

6. Provider mutations (authorized only)

```bash
export GOOGLE_ACCESS_TOKEN=...
./scripts/ross-infinite seo google config/seo/ross.co.ownership.json addSite --execute
./scripts/ross-infinite seo google config/seo/ross.co.ownership.json submitSitemap --execute
export INDEXNOW_KEY=...
./scripts/ross-infinite seo indexnow config/seo/ross.co.ownership.json --execute
```

## Evidence

Timestamped receipts under `release-evidence/seo/` include SHA-256 sidecars. Do not mark `PROVIDER_VERIFIED` until the search provider confirms ownership.

## Rollback

Restore previous `seo/generated/public/` artifacts from the last known good receipt and remove unverified DNS TXT records if necessary.
