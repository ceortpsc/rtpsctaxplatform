# Prod Terraform Environment

Populate approved production placeholders after sign-off.

## Before population

1. Complete architecture review.
2. Record `INF-005` approval in `policy/procedures/production-signoffs/registry.json`.
3. Confirm secret-manager and tunnel allowlists are ready (`CFG-004`, `BND-005`).

## After population

- Keep credentials out of Terraform values committed to git.
- Re-run `./scripts/aol run compliance -- --live` and archive the checklist log.
