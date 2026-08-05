# Ross Runtime Portal Policy Manual

## Acceptable Use

- Use only for lawful authorized business and software operations.
- Fraud, impersonation, counterfeiting, security bypass, malware, unauthorized scraping, surveillance, and destructive testing are prohibited.
- AI output may not be the sole basis for legal, tax, identity, eligibility, credit, employment, insurance, benefits, or law-enforcement decisions.

## Accessibility

- Support keyboard navigation, visible focus, semantic structure, accessible names, sufficient contrast, zoom, meaningful errors, and reduced motion.
- Do not rely on color alone for status.

## Access Control and Identity

- Replace development access codes with OIDC or SAML SSO in production.
- Require MFA for privileged, administrative, developer, and support access.
- Use RBAC, least privilege, deny-by-default, individual accounts, and separation of duties.
- Review privileged access quarterly and keep secrets in an approved secrets manager.

## Artificial Intelligence Governance

- Document purpose, engine or model, inputs, outputs, owner, limitations, and evaluation.
- Require human review, override, and escalation for material decisions.
- Evaluate accuracy, bias, privacy, prompt injection, security, and unsafe behavior.
- AI must not independently approve identity, tax, legal, credit, employment, insurance, benefits, or law-enforcement outcomes.

## Business Continuity and Disaster Recovery

- Define recovery time and recovery point objectives for critical services.
- Keep protected backups outside the primary failure domain.
- Test restoration, worker recovery, database recovery, credential recovery, and rollback.

## Change and Release Management

- Classify changes as standard, normal, or emergency.
- Production releases require traceable source, immutable version, passing controls, checksum, release notes, deployment plan, rollback plan, and approval.
- Published tags are immutable.

## Data Retention and Disposal

- Retention must be purpose-based and no longer than required by law, contract, operations, or legal hold.
- Transient uploads are deleted after processing unless retention is approved.
- Deletion covers primary storage, caches, queues, exports, replicas, and backup expiration.

## Incident Response

- Prepare owners, contacts, playbooks, evidence storage, and exercises.
- Detect, assign severity, preserve evidence, contain, eradicate, recover, and document lessons learned.
- Every material incident receives an incident ID, owner, timeline, evidence, actions, and closure approval.

## Intellectual Property and Brand

- Use Ross Tax Pro Software Co. names, logos, code, documentation, and original assets only with authorization.
- Track third-party licenses and verify rights before importing code, artwork, fonts, or data.
- Do not imply affiliation with AOL or unrelated companies; classic-portal inspiration must remain original.
- Trademark symbols do not establish registration.

## Logging, Monitoring, and Audit

- Record request ID, trace ID, actor, action, object, result, timestamp, worker, job, and incident references when appropriate.
- Never log passwords, tokens, private keys, full SSNs, payment data, or raw identity images.
- Protect logs from alteration, restrict access, synchronize time, rotate storage, and test alerts.

## Privacy and Data Protection

- Collect the minimum data required for a documented purpose.
- Classify data and document purpose, owner, source, recipients, retention, and authority.
- Encrypt data in transit and at rest and apply least privilege and MFA.
- Production personal data may not be copied to public repositories or unmanaged developer workstations.

## Records Management

- Classify records by function, sensitivity, owner, retention rule, and system of record.
- Official records must be complete, attributable, protected, searchable, and exportable.
- Legal holds override normal disposal only for identified records.

## Runtime and Worker Operations

- Use named queues, bounded retries, idempotent tasks, heartbeat tracking, timeouts, and dead-letter handling.
- Self-healing may restart workers but must not hide repeated failure.
- Restart storms trigger an incident and circuit breaker.
- Readiness fails when critical dependencies or required worker coverage are unavailable.

## Scan Validation Safety

- The engine may measure quality, detect boundaries, compare authorized parsed fields, redact regions, and route human review.
- It must not regenerate, reconstruct, alter, imitate, or certify a driver license, ID, passport, or security feature.
- Low-quality or inconsistent scans must be recaptured or escalated, never fabricated.

## Secure Development Lifecycle

- Plan assets, data classes, abuse cases, dependencies, and acceptance criteria.
- Threat-model trust boundaries, authentication, authorization, data flow, failures, and logging.
- Use strict validation, safe file handling, parameterized data access, and secret scanning.
- Verify with tests, static analysis, dependency review, contract checks, container checks, and peer review.
- Release immutable artifacts with checksums, provenance, manifests, approvals, and rollback instructions.

## Software Supply Chain Security

- Pin and review dependencies and verify source and publisher.
- Use least-privilege CI permissions and OIDC instead of long-lived cloud keys.
- Scan source, dependencies, containers, and artifacts.
- Produce checksums, provenance, release manifests, and an SBOM target.

## Third-Party Risk Management

- Assess vendor security, privacy, availability, data location, subcontractors, incident notice, deletion, authentication, logging, and continuity before integration.
- Grant minimum scopes and keep credentials in a secrets manager.
- Reassess critical providers annually and before material expansion.

## Versioning and Release Channels

- Use semantic versioning and immutable release evidence.
- Development, alpha, beta, release candidate, stable, LTS, enterprise, and hotfix channels represent distinct maturity and approval states.
- Do not rewrite published tags or classify one unvalidated artifact as every channel.

## Vulnerability Management

- Use dependency alerts, scanners, tests, vendor notices, code review, and responsible disclosure.
- Prioritize exploitability, exposure, privilege, data sensitivity, and business impact.
- Critical exposed issues require immediate containment and expedited remediation.
- Close findings only after remediation validation.

## Exceptions and Evidence

Every exception requires a documented risk, owner, compensating controls, approval, expiration date, and remediation plan. Maintain evidence sufficient to show approval, implementation, review, and corrective action.
