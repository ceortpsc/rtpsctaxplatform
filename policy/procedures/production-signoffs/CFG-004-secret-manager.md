# CFG-004 — Secret manager provisioning

## Scope

Provision API / TDS / tunnel credentials only in the approved secret manager.
Do not commit values to source control.

## Evidence to attach

- Secret manager inventory ID:
- Secrets provisioned (names only):
- Rotation owner:
- Approver name / role:
- Approval date (ISO-8601):

## Registry update

When approved, set `signoffs.CFG-004` in `registry.json` to `status: "approved"`
with `approver` and `approvedAt`.
