# Operations Runbook

## Daily Checks

1. Confirm gateway and domain-service `/health` endpoints respond.
2. Review worker heartbeats and one-shot execution logs.
3. Verify secure tunnel configuration remains environment-sourced and approval-backed.
4. Confirm refund-status event sources remain approved and non-scraping.

## Deployment Steps

1. Apply environment-specific Terraform placeholders after review.
2. Provision secrets in the approved secret manager.
3. Run CI quality gates: lint, test, build, compliance.
4. Deploy services and workers with environment-specific configuration.
5. Validate `/health` and `/metadata` endpoints.

## Incident Response

- **SEV-1**: disable new transmissions, preserve evidence, escalate security/compliance leads.
- **SEV-2**: pause affected worker or pipeline, collect logs, validate upstream approvals.
- **SEV-3**: isolate module-level defects and retry with approved procedures.

## Recovery Notes

- Workers are safe to run in `--once` mode for controlled replay.
- Build manifest output in `build/platform-manifest.json` can be used to validate module presence.
