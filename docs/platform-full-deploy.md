# Full platform deploy (RTPSC + ROSS.CO Infinite)

Deploys the entire local platform stack with artifact provisions.

```bash
./rtpsc deploy-full --smoke
# or
pnpm run deploy:full:smoke
make deploy-full-smoke

# stay live
./rtpsc deploy-full
```

## What it provisions

1. Gates: lint → test → build (`--skip-gates` to bypass)
2. SEO DNS/token artifact deploy (`deploy/seo`, `presence/rossco`)
3. ROSS.CO Infinite doctor + release evidence
4. K8s/Terraform/OpenAPI deploy stubs under `tools/ross-infinite/deploy`
5. HTTP services: `:3000`–`:3006`, `:3010`, IRS `:8820`, AI workforce `:8860`
6. ROSS.CO registry `:4873`
7. Presence static SEO surface `:3080`
8. Background `workflow-runner`
9. One-shot workers: tds, transcript-pull, live-source
10. Manifest: `build/platform-deploy-manifest.json`

## Flags

| Flag | Meaning |
|------|---------|
| `--smoke` | Health-check once and exit |
| `--skip-gates` | Skip lint/test/build |
| `--skip-workers` | Skip one-shot workers |

## Notes

- This is a **local/dev deploy**. Public DNS for `ross.co` still requires registrar apply (Namefind/GoDaddy) using `deploy/seo/dns/*`.
- Cloud production registry cutover remains gated by `docs/rossco-production-activation.md` (AWS OIDC / CloudFormation).
