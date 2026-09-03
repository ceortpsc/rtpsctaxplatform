# Ross Tax Pro Software Co. Employer Verification Registry

## Purpose

This registry is the canonical enrollment and integration map for employer verification, wage reporting, employment eligibility, new-hire reporting, income/employment verification fulfillment, 1099/gig verification, and related payroll/HR verification systems used by Ross Tax Pro Software Co.

The registry distinguishes **provider enrollment** from **internal readiness**. A system is not marked enrolled until the provider or government system confirms the account/company enrollment.

## Status model

- `READY_TO_ENROLL` — business data can be prepared; provider enrollment has not yet been confirmed.
- `AUTHORIZED_SIGNER_REQUIRED` — the provider requires an authorized company representative, identity proof, legal acceptance, or account activation.
- `PAYROLL_INTEGRATION_REQUIRED` — participation requires payroll/HRIS integration, vendor onboarding, or a data feed.
- `ACTIVE_ONLY_IF_APPLICABLE` — use only when the relevant filing/employment rule applies.
- `ENROLLED_CONFIRMED` — provider enrollment has been verified.
- `DO_NOT_ENROLL` — obsolete or retiring platform.

## Priority registration stack

### Tier 1 — Government employer systems

1. **USCIS E-Verify** — employment eligibility confirmation for new hires when used/required. Enrollment requires company data, hiring-site information, a Program Administrator, a signatory, and acceptance of E-Verify terms.
2. **SSA Business Services Online / SSNVS** — W-2/W-2c wage reporting, wage-file status, and name/SSN verification for employees for wage-reporting purposes.
3. **IRS e-Services TIN Matching** — validates payee name/TIN combinations before certain information returns are filed.
4. **IRS IRIS** — strategic information-return filing platform for 1099-series and related information returns; IRIS TCC required for filing access.
5. **Texas Workforce Commission Unemployment Tax Registration** — employer unemployment-tax account where Texas liability applies.
6. **Texas Employer New Hire Reporting** — new-hire/rehire reporting; Ross HR should trigger this workflow from the workforce master record.

### Tier 2 — Employer verification fulfillment networks

1. **Equifax The Work Number** — employer-contributor network for automated employment and income verification. Employer participation is typically tied to payroll/HRIS data contribution and vendor onboarding.
2. **Experian Verify / Employer Services** — employer verification-fulfillment service with employer portal, employee access, verifier credentialing, income verification and employment verification.
3. **Truework** — VOE/VOI/reverification network supporting instant data, payroll credentials, smart outreach and supported 1099/gig-platform workflows.
4. **Truv** — permissioned payroll/income/employment connectivity across payroll, employer and gig-platform integrations; treat as an integration target rather than a mandatory registry.

### Retiring / migration-only

- **Vault Verify** — do not start a new Ross enrollment. The platform is being retired into Equifax Workforce Solutions.

## Gig and contractor verification

Ross should support both W-2 employees and commission/1099 contractor workflows, but worker classification must remain a legal/payroll determination rather than a software toggle.

The internal verification engine should support:

- verification of employment;
- verification of income;
- employment-status confirmation;
- start/end dates;
- title/position;
- pay-frequency and compensation-type fields;
- commission-eligible position status;
- contractor/1099 verification where legally appropriate;
- employee/contractor consent capture where required;
- signed verification letters;
- provider request IDs and audit events;
- disclosure minimization and role-based access.

## Ross Prime Payroll / HR workflow

```text
WORKFORCE MASTER
      ↓
VERIFICATION REQUEST
      ↓
IDENTITY + CONSENT CHECK
      ↓
PROVIDER ROUTER
      ├── E-Verify
      ├── SSA BSO / SSNVS
      ├── IRS TIN Matching
      ├── IRS IRIS
      ├── Texas New Hire
      ├── Equifax TWN
      ├── Experian Verify
      ├── Truework
      └── Truv
      ↓
RESULT / PENDING STATE
      ↓
VERIFY RESULT
      ↓
AUDIT EVENT
      ↓
WORKFORCE FILE
```

## Security rules

- Never store an EIN, employee SSN, provider password, private key, ID.me credential, Login.gov credential or reusable OAuth token in public configuration.
- Store provider credentials only as secure-vault references.
- Employee SSNs may be used only in authorized workflows that require them and must not be copied into the general employer registry.
- SSNVS is not an applicant-screening service; its use is limited to the SSA-authorized wage-reporting context.
- Income/employment disclosures must follow applicable consent, FCRA, privacy and provider requirements.
- External provider status is not trusted blindly; verify enrollment or transaction state when the provider supports a read-back check.

## Enrollment record schema

```json
{
  "providerId": "uscis-e-verify",
  "company": "Ross Tax Pro Software Co.",
  "status": "AUTHORIZED_SIGNER_REQUIRED",
  "externalAccountIdRef": null,
  "credentialRef": null,
  "enrolledAt": null,
  "lastVerifiedAt": null,
  "ownerLane": "HR_COMPLIANCE",
  "nextAction": "Complete provider enrollment and capture confirmation"
}
```

## Internal product features

The Ross employer-verification module should expose:

- Provider Registry
- Enrollment Dashboard
- Verification Request Inbox
- Employee Consent Center
- Verification Letter Generator
- Verification Status Timeline
- New-Hire Reporting Trigger
- E-Verify Case Trigger
- SSNVS Wage Validation Trigger
- TIN Matching Trigger
- IRIS Filing Trigger
- W-2 / 1099 Evidence Links
- Payroll/HRIS Adapter Status
- Provider Credential Vault References
- Audit Log
- Failure / Retry Queue
- API / Webhook Adapter Directory
- Employment and 1099 Contractor Verification Profiles

## Current enrollment state

The internal registry is implemented. External providers remain unconfirmed until each government/vendor enrollment returns a successful company registration or account identifier.
