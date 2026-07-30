# RTPSC Environment and Branch Matrix

**Repository:** `ceortpsc/rtpsctaxplatform`  
**Established:** 2026-07-30  
**Application:** Ross Tax Pro Software Co. Tax Platform / Masterfile Reconciliation Suite

## Controlled branches

| Branch | Intended environment | Promotion purpose | External runtime status |
|---|---|---|---|
| `development` | Development | Integration, component validation, non-production smoke testing | Requires configured hosting target |
| `staging` | Staging | Release-candidate validation, UAT, security and compliance evidence | Requires configured hosting target |
| `main` | Production-controlled | Approved release source and production artifact build | Requires configured hosting target and production approvals |

All three branches were seeded from the verified application-foundation merge commit `d7c446bc5ea87e74ffa1e83b6200d490fa7bef3a`.

## Promotion model

```text
feature/*
  -> development
  -> staging
  -> main
```

Promotion must remain fail-closed. A branch name does not establish a live deployment by itself.

Required gates before promotion to `main`:

- lint, test and build pass;
- security and secret scans pass;
- no real taxpayer data in fixtures or artifacts;
- authorization and RBAC checks pass;
- environment-specific configuration is present in an approved secret store;
- external provider integrations remain disabled unless credentials, contracts and production authorization are verified;
- human release approval is recorded.

## Current deployment boundary

The repository workflow `.github/workflows/rtpsc-deploy.yml` currently builds and uploads the `rtpsc-build` artifact for `development`, `staging` and `main`. Its environment deploy step is still a scaffold message and does not update an external AWS, Cloudflare, Amplify, ECS, Elastic Beanstalk or other runtime target.

Accordingly:

- GitHub branch seeding: **COMPLETE**
- Foundation source promotion: **COMPLETE**
- CI artifact generation: **CONFIGURED**
- External development runtime deployment: **BLOCKED_EXTERNAL_CONFIGURATION**
- External staging runtime deployment: **BLOCKED_EXTERNAL_CONFIGURATION**
- External production runtime deployment: **BLOCKED_EXTERNAL_CONFIGURATION_AND_APPROVAL**

No document or interface may describe a scaffold-only job as a successful live deployment.
