# Multi-Repository Deployment Architecture

## Purpose

Keep the Ross Tax Pro ecosystem interoperable while preserving repository, branch, environment, and release independence.

## Repositories

- `ceortpsc/rtpsctaxplatform` — core tax platform
- `ceortpsc/ross-primeweb-etrac` — eTRAC runtime boundary
- `ceortpsc/rtpsc-backoffice-full-integration-module` — back-office integration layer
- `ceortpsc/IRSRUNTIME` — IRS runtime boundary
- `ceortpsc/ross-tax-pro-university` — planned university LMS repository

## Branch policy

- `feature/*` → Vercel Preview
- `bugfix/*` → Vercel Preview
- `develop` → Staging
- `release/*` → Release Candidate
- `hotfix/*` → controlled production correction
- `main` → Production

Branches remain independently versioned. Changes cross repository boundaries through explicit versioned APIs, events, SDKs, or contracts—not direct source imports.

## CI/CD gates

1. Dependency installation
2. Secret scan
3. Static analysis/type checking
4. Unit tests
5. Route/contract checks
6. Integration tests
7. Build
8. Preview/staging deployment
9. Smoke tests
10. Production promotion

## Security rules

- No production secrets in Git.
- Entra, database, AI, SMTP, payment, and provider credentials belong in Vercel/Azure/AWS secret stores.
- Sensitive mutations must produce audit events.
- Integration handlers must be idempotent.
- Production release must have a rollback path.

## Current implementation

This repository now contains the canonical multi-repository deployment manifest and Vercel environment matrix. The files are committed to the repository default branch as implementation configuration. The dedicated University repository is referenced as `planned-repository` until it exists.
