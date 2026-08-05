# Ross Runtime Policy Rollout

## 1. Adopt

Ross Tax Pro Software Co. executive management approves the policy manifest and assigns operational owners for security, engineering, operations, product, and data.

## 2. Configure

- Replace development access codes with OIDC or SAML SSO and MFA.
- Map retention classes to scheduled deletion jobs.
- Configure private security and privacy contacts.
- Configure protected release environments and required approvers.
- Map security controls to CI, infrastructure, and runtime settings.

## 3. Enforce

Run:

```powershell
python scripts/validate_policies.py
```

Require `Ross Runtime Policy Validation` before merge.

## 4. Preserve evidence

Retain policy approvals, exceptions, access reviews, release evidence, vulnerability records, incidents, restoration tests, and vendor assessments.

## 5. Review

Review at least annually and after material incidents, architecture changes, new vendors, new data uses, or new legal obligations.
