# DNS / Token Artifact Deploy

## Command

```bash
./scripts/seo-deploy-dns-tokens.sh
# or
./scripts/ross-infinite seo deploy config/seo/ross.co.ownership.json
./scripts/ross-infinite seo deploy config/seo/ross.co.ownership.json --apply-dns
```

## What gets deployed in-repo

| Artifact | Path |
|----------|------|
| Zone file | `deploy/seo/dns/ross.co.zone` |
| Registrar change request | `deploy/seo/dns/registrar-change-request.json` |
| Route53 change batch | `deploy/seo/dns/route53-change-batch.json` |
| Live DNS observation | `deploy/seo/dns/dns-observation.json` |
| Apply instructions | `deploy/seo/dns/namefind-godaddy-instructions.md` |
| Public token mirror | `deploy/seo/public/` |
| Presence landing sync | `presence/rossco/` (IndexNow key, BingSiteAuth.xml, seo-head, robots, sitemap) |

## Live observation (this environment)

- Nameservers: `ns1.namefind.com`, `ns2.namefind.com`
- Existing TXT: `v=spf1 -all`
- Apex HTTP: Namefind parking lander (not RTPSC hosting yet)
- No registrar API credentials available → live TXT apply is **artifact-ready**, not auto-pushed

## Provider tokens

Copy and fill:

```bash
cp config/seo/tokens.env.example config/seo/tokens.local.env
```

Then re-run deploy so Google/Bing meta + DNS TXT values are real. IndexNow key is generated stably from ownership identity and staged as a public file.

## Evidence state

`DEPLOYED` = DNS/token **artifacts and presence files** are staged.  
`PROVIDER_VERIFIED` still requires Google/Bing confirmation after registrar TXT/meta publication.
