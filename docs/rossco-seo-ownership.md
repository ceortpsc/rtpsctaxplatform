# ROSS.CO SEO Ownership & Search Console

Executable ownership-prevalidation and SEO control plane for ROSS.CO Infinite.

## Owner assertion

```json
{
  "legalName": "ROSS.CO",
  "ownerAssertion": true,
  "ownerName": "Condre Dvon Ross",
  "assertedAt": "2026-07-26T00:00:00-05:00"
}
```

## CLI

```bash
node tools/ross-infinite/src/cli.mjs seo plan config/seo/ross.co.ownership.json
node tools/ross-infinite/src/cli.mjs seo generate config/seo/ross.co.ownership.json
node tools/ross-infinite/src/cli.mjs seo prevalidate config/seo/ross.co.ownership.json
node tools/ross-infinite/src/cli.mjs seo prevalidate config/seo/ross.co.ownership.json --live
node tools/ross-infinite/src/cli.mjs seo google config/seo/ross.co.ownership.json listSites
node tools/ross-infinite/src/cli.mjs seo google config/seo/ross.co.ownership.json submitSitemap --execute
node tools/ross-infinite/src/cli.mjs seo indexnow config/seo/ross.co.ownership.json --execute
```

## Credentials (never commit)

```bash
export GOOGLE_SITE_VERIFICATION_TOKEN='provider-issued-meta-token'
export GOOGLE_DNS_TXT_TOKEN='google-site-verification=provider-issued-token'
export BING_SITE_AUTH_TOKEN='provider-issued-bing-token'
export INDEXNOW_KEY='32-to-128-character-production-key'
export GOOGLE_ACCESS_TOKEN='authorized-oauth-token'
```

Provider mutations are dry-run unless `--execute` is supplied.

## Generated assets

`seo/generated/public/`:

- `seo-head.html`
- `robots.txt`
- `sitemap.xml`
- `software-application.jsonld`
- `<INDEXNOW_KEY>.txt`

## Agent assignment

```bash
./rtpsc agents assign seo-ownership-prevalidate seo-ownership-agent
./rtpsc agents run seo-ownership-prevalidate
```

See also `docs/ross-infinite/README.md` and `docs/ROSS_CO_SEO_Ownership_Runbook.md`.
