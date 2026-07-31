# RTPSC Foundation Promotion and Deployment Evidence

**Evidence date:** 2026-07-30  
**Repository:** `ceortpsc/rtpsctaxplatform`  
**System:** Ross Tax Pro Software Co. Tax Platform / Masterfile Reconciliation Suite

## Source promotion

Pull request **#38 — Unify RTPSC application with Sovereign Ledger design system** was promoted from draft, verified as mergeable, and squash-merged to `main`.

- PR head: `3938d857e70d0fd1041910c95cf6f65ccbd3e31f`
- Main merge commit: `d7c446bc5ea87e74ffa1e83b6200d490fa7bef3a`
- Changed files: 51
- Additions: 2,277
- Deletions: 154

Delivered foundation includes:

- shared `@rtp/ui-design-system` package;
- cream, navy and gold Sovereign Ledger visual system;
- shared shell, tokens, components and brand assets;
- role-aware navigation definitions;
- `staff-portal` service on the documented local port;
- updated enrollment, invoice, POS/CRM, refund, AI workforce, modules and web-portal surfaces;
- application route inventory;
- page inventory and role-route access matrix;
- accessibility and application-security review documents;
- page-upgrade completion matrix.

## Verified pull-request checks

GitHub Actions completed successfully for the PR head:

| Workflow | Run | Result |
|---|---:|---|
| `ci` | 30534424432 | SUCCESS |
| `compliance-scaffold` | 30534424720 | SUCCESS |

The PR report recorded:

- lint: pass;
- tests: 184 pass;
- build: pass.

These results establish the foundation commit as a verified source baseline. They do not establish that every planned application module or external integration is live.

## Environment branches

The following branches were seeded from the merged foundation commit:

- `development`
- `staging`
- `main` as the production-controlled source branch

See `docs/operations/ENVIRONMENT_BRANCH_MATRIX.md` for promotion and gating rules.

## Deployment artifact status

The repository CI/CD workflow is configured to build on `development`, `staging` and `main` and upload a GitHub Actions build artifact.

Current truthful status:

| Deliverable | Status |
|---|---|
| Git source committed and pushed | COMPLETE |
| Foundation merged to `main` | COMPLETE |
| Development branch seeded | COMPLETE |
| Staging branch seeded | COMPLETE |
| CI/build artifact workflow | CONFIGURED |
| External development runtime | BLOCKED_EXTERNAL_CONFIGURATION |
| External staging runtime | BLOCKED_EXTERNAL_CONFIGURATION |
| External production runtime | BLOCKED_EXTERNAL_CONFIGURATION_AND_APPROVAL |
| IRS MeF production transmission | BLOCKED_CREDENTIALS_AND_EXTERNAL_AUTHORIZATION |

The current deploy job emits scaffold messages only. It does not deploy to AWS, Cloudflare, Amplify, ECS, Elastic Beanstalk or another live runtime. This evidence file deliberately does not label that scaffold as a live deployment.

## Remaining implementation scope

The merged foundation is not equivalent to completion of every planned RTPSC phase. Outstanding work still includes, where not already implemented and verified on `main`:

- live staff dashboard data contracts;
- production client registry and record-level authorization;
- secure IRS notice drag-and-drop intake;
- document scanning, classification and human review;
- Masterfile reconciliation case workspace;
- TC 570/810 detection and verified reversal-observation workflows;
- payment, refund and transcript reconciliation;
- production database connectivity and migrations;
- secret-store configuration and credential rotation evidence;
- external hosting deployment;
- security, privacy, accessibility and ERO operational acceptance.

## Release statement

The application foundation is **MERGED_AND_VERIFIED**. Git environment branches are **SEEDED**. Live external environments remain **NOT_DEPLOYED** until an actual hosting target, credentials, variables, networking, database and human production approvals are configured and validated.
