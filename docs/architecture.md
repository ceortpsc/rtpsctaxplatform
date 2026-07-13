# Architecture Overview

## Context

The platform provides a governed baseline for tax operations, secure integration points, worker orchestration, and analytics. All external integration touchpoints are stubs pending legal approval, security review, and environment-specific credential provisioning.

## C4-Style System Context

```text
[Operators / Tax Professionals]
        |
        v
[API Gateway] ---> [Refund Status Service] ---> [Refund Status Pipeline]
      |                |                             |
      |                v                             v
      |--------> [Transcript Service] ------> [Masterfile Pipeline]
      |                |
      |                v
      |          [Transcript Pull Worker]
      |
      v
[Analytics Service] ---> [Analytics Center] ---> [Refund Intelligence Engine]
      |
      v
[TC Code Engine]

[API Gateway] ---> [Transmission Pipeline] ---> [Secure Tunnel Adapter Stub]
                                      |
                                      v
                               [TDS Worker]

[Live Source Fetcher] ---> Approved external sources only (no scraping)
```

## Container View

- **API Gateway**: exposes health and route metadata, accepts compliant transmission orchestration requests, and centralizes ingress concerns.
- **Refund Status Service**: owns event-driven refund status updates and subscription metadata.
- **Transcript Service**: owns account transcript and TDS orchestration interfaces.
- **Analytics Service**: aggregates analytics and refund intelligence endpoints.
- **Workers**: long-running or one-shot execution shells for TDS, transcript pulls, and approved live-source ingestion.
- **Pipelines**: model stage-by-stage processing for transmission, masterfile normalization, and refund status events.
- **Engines**: analytical and rules-oriented modules for refund intelligence, analytics center coordination, and TC code lookups.

## Component Responsibilities

### Shared packages

- `platform-core`: runtime config loading, health-response helpers, service/worker descriptors.
- `client-config`: required client ID and secret placeholders, plus governance text.
- `secure-tunnel`: compliant adapter contract and approval checkpoints.

### Security boundaries

1. Secrets are environment-only and absent from source control.
2. Secure tunnel code is an interface scaffold only; no hardcoded credentials or unapproved endpoints.
3. Refund status processing is event-driven and explicitly excludes scraping.
4. Sensitive taxpayer integrations require approval gates before implementation.

## Deployment Topology

```text
Local/Dev/Stage/Prod
    |
    +-- Terraform env folder -> platform-service module -> compute/network/secret placeholders
    +-- CI workflow -> lint/test/build/compliance checks
    +-- Docker Compose -> local Postgres/Redis placeholders for iterative development
```
