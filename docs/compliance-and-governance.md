# Compliance and Governance

## Non-Negotiable Boundaries

- No unauthorized access to IRS systems.
- No implementation of non-public channels without written approval.
- No scraping-based refund-status collection.
- No credentials, secrets, or certificates in source control.

## Approval Checkpoints

1. Legal approval for each production integration.
2. Security review for tunnel, credential, and data-handling changes.
3. Data-governance review for taxpayer data retention and masking.
4. Operations sign-off for worker scheduling and incident playbooks.

## Sensitive Data Handling

- Use environment variables or approved secret stores only.
- Redact secrets in logs and operator-visible metadata.
- Document handling procedures before enabling any taxpayer data exchange.
