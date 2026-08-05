# Governance Policy

## Purpose

Establish decision rights, accountability, approval gates, evidence, and exceptions for Ross Runtime Portal engineering, security, privacy, operations, releases, and data.

## Roles

- Executive sponsor: risk tolerance and production authorization.
- Product owner: requirements, priorities, user impact, and release readiness.
- Security owner: security architecture, incidents, vulnerabilities, and risk acceptance.
- Engineering owner: code quality, architecture, testing, and deployment integrity.
- Operations owner: runtime health, monitoring, backups, workers, and recovery.
- Data owner: collection, access, retention, sharing, and disposal.
- Reviewer: independent evaluation of material changes.

## Decision rules

1. Production changes require a tracked change, peer review, passing controls, deployment plan, and rollback plan.
2. Security-sensitive changes require security review.
3. Changes affecting personal, tax, financial, identity, or authentication data require data-owner review.
4. Emergency changes require retrospective review within two business days.
5. Exceptions require an owner, compensating controls, approval, remediation plan, and expiration date.

## Evidence

Retain approvals, CI results, release manifests, access reviews, incident records, recovery tests, vulnerability findings, and risk acceptances according to policy.
