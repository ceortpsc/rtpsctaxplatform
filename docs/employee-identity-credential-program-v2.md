# RTPSC Employee Identity, Account & Credential Program v2

## 1. Account creation

An employee account begins with an employee profile, not a password. Required data: employee number, legal/business name, work email, job title, department, manager, workspace, requested role, and reason for access.

The request is reviewed, the username is reserved, the appropriate role is approved, and an invitation is issued. The employee creates their own password through a one-time activation flow. Administrators must not receive or retain the employee's password.

## 2. Username controls

Usernames are unique within a workspace, normalized to lowercase, 6-64 characters, and restricted to `[a-z][a-z0-9._-]*`. A username is immutable after activation unless an audited change request is approved.

## 3. Password controls

Passwords are 15-128 characters, rejected when common/breached or based on username/email, stored only as a password hash, protected by failed-attempt lockout, and never placed in emails, logs, exports, tickets, screenshots, or CRM notes. Privileged roles require MFA before activation. Administrator resets force a new password at next sign-in.

## 4. Credential types

`password`, `totp`, `webauthn`, `recovery_code`, and `api_key` are separate credential classes. API keys are service credentials and are never treated as employee passwords. Credential records retain status, issuance time, expiry, revocation, and audit evidence.

## 5. Role governance

Roles are `owner`, `admin`, `ero`, `practitioner`, `preparer`, `collector`, and `viewer`. Baseline access is deny-by-default. Role access is further filtered by workspace/tenant, assignment, sensitivity, lifecycle state, approval state, and separation-of-duties requirements.

### Role responsibilities

| Role | Core responsibility | Privileged capabilities | Strict exclusions |
|---|---|---|---|
| Owner | Enterprise governance | Policy, role, security, financial oversight | Cannot erase audit evidence |
| Admin | Workspace administration | Users, configuration, reporting | Cannot self-approve privileged changes |
| ERO | ERO/e-file supervision | Review, approve, transmit, practitioner governance | Cannot bypass audit or immutable financial history |
| Practitioner | Tax preparation and client service | Prepare/edit assigned work, review | No independent privileged payout or policy administration |
| Preparer | Preparation support | Data entry, documents, assigned return work | No e-file transmission or role admin |
| Collector | Receivables/collections/recovery | Payment plans, collection actions, recovery | No tax-return outcome changes |
| Viewer | Read-only visibility | Approved read/report access | No create/edit/approve/transmit/admin |

## 6. Account state machine

`invited -> pending -> active -> suspended/locked -> disabled -> terminated`.

Activation requires identity verification, approved role assignment, credential setup, and required MFA for privileged roles.

## 7. Access removal

Termination or authorized suspension disables sign-in, revokes sessions, revokes active credentials, removes active role assignments, and preserves audit history. Access changes caused by job/department changes require an access review.

## 8. Recovery

Password reset and credential recovery are separate workflows requiring identity verification. Recovery links are single-use, short-lived, and represented in storage by fingerprints rather than raw tokens.

## 9. Audit

Record account creation, activation, suspension, lockout, termination, username changes, password issuance/reset/completion, MFA enrollment/removal, role requests/grants/revocations, credential issuance/revocation, session revocation, and export attempts.

## 10. Segregation of duties

The person requesting privileged access should not be the sole approver. Privileged role assignment, production e-file transmission, high-value write-offs, practitioner payout approval, and credential revocation should use independent approval where configured.

## 11. Data rules

Never hard-delete employee identity, credential issuance, role assignment history, session events, or audit evidence. Use status transitions and revocation events. Do not expose credential secrets through analytics or exports.
