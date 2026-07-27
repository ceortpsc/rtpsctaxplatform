# Apply ROSS.CO DNS verification at current registrar

Observed nameservers: `ns2.namefind.com, ns1.namefind.com`

## Google domain property TXT

1. Open the DNS panel for **ross.co** (Namefind/GoDaddy if NS matches `namefind.com`).
2. Add TXT record:

| Field | Value |
|-------|-------|
| Type | TXT |
| Name / Host | `@` |
| Value | `google-site-verification=PENDING_REPLACE_WITH_PROVIDER_ISSUED_TOKEN` |
| TTL | 300 |

3. Keep existing SPF TXT (`v=spf1 -all`) — do not delete it.
4. Wait for propagation, then run:

```bash
./scripts/ross-infinite seo prevalidate config/seo/ross.co.ownership.json --live
```

## File tokens already staged in presence

- `presence/rossco/ef76e5a3d8eea7b561115a17ef8d31fe44a6bea9b144d0d2fb432921955e6f3d.txt` (IndexNow)
- `presence/rossco/BingSiteAuth.xml`
- `presence/rossco/seo-head.html` (meta tags)
- `deploy/seo/public/` mirror

## Route53 (only after NS cutover)

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch file://deploy/seo/dns/route53-change-batch.json
```

## Status honesty

File/DNS **artifacts** are deployed in-repo. Provider verification stays pending until Google/Bing confirm the token.
