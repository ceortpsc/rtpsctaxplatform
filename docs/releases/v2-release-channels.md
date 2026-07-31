# Ross Tax Pro Software Co Platform v2.0 release channels

## Canonical identity

The active repository identity is **`v2.0-dev`** with internal SemVer **`2.0.0-dev.0`**. This is the honest development channel for the current platform state.

Public labels and internal versions are intentionally separate. The public labels remain concise and branded; the internal SemVer values provide deterministic package and artifact ordering.

| Public channel | Internal SemVer | Intended use | Production eligible |
|---|---|---|---:|
| `v2.0-dev` | `2.0.0-dev.0` | Developer build | No |
| `v2.0-alpha` | `2.0.0-alpha.0` | Early unstable build | No |
| `v2.0-beta` | `2.0.0-beta.0` | Feature-complete but not final | No |
| `v2.0-rc1` | `2.0.0-rc.1` | Release candidate | No |
| `v2.0-stable` | `2.0.0` | Final production profile | Yes, after approval gates |
| `v2.0-lts` | `2.0.0+rtpsc.lts` | Long-term support profile | Yes, after approval gates |
| `v2.0-enterprise` | `2.0.0+rtpsc.enterprise` | Enterprise-grade profile | Yes, after approval gates |
| `v2.0-hotfix` | `2.0.1-hotfix.0` | Emergency patch profile | Yes, after emergency gates |

## Promotion graph

```text
v2.0-dev
  → v2.0-alpha
  → v2.0-beta
  → v2.0-rc1
  → v2.0-stable
       ├─→ v2.0-lts
       ├─→ v2.0-enterprise
       └─→ v2.0-hotfix

v2.0-lts ─────────→ v2.0-hotfix
v2.0-enterprise ──→ v2.0-hotfix
v2.0-hotfix ──────→ stable / lts / enterprise maintenance lines
```

Skipping the promotion graph is blocked by `evaluatePromotion()`. The release manager also checks all evidence required by the target profile.

## Commands

```bash
./rtpsc version
./rtpsc release list
./rtpsc release show enterprise
./rtpsc release validate all
./rtpsc release build all --clean
```

Generated files:

```text
build/releases/
├── catalog.json
├── SHA256SUMS
├── v2.0-dev/manifest.json
├── v2.0-alpha/manifest.json
├── v2.0-beta/manifest.json
├── v2.0-rc1/manifest.json
├── v2.0-stable/manifest.json
├── v2.0-lts/manifest.json
├── v2.0-enterprise/manifest.json
└── v2.0-hotfix/manifest.json
```

Each manifest contains:

- public release tag and internal SemVer;
- source commit and build number;
- environment name;
- required, supplied, and missing release gates;
- production eligibility;
- support policy;
- SHA-256 integrity digest;
- an explicit statement that external runtime deployment is not claimed.

## Production control boundary

A generated `v2.0-stable`, `v2.0-lts`, `v2.0-enterprise`, or `v2.0-hotfix` manifest is a **release profile**, not proof of deployment. Production status requires all of the following outside the channel selector:

1. required CI and QA evidence;
2. security and compliance approval;
3. authorized human release approval;
4. signed or otherwise integrity-verifiable artifacts;
5. environment-specific deployment receipt;
6. rollback plan and tested recovery path;
7. external credentials and service approvals where required;
8. post-deployment health and audit evidence.

No channel can authorize IRS, Treasury, MeF, TDS, financial-account, taxpayer-record, or masterfile activity.

## Emergency hotfix rule

`v2.0-hotfix` is not a shortcut around controls. It uses a narrower evidence set focused on the incident:

- lint;
- targeted tests;
- build verification;
- security review;
- authorized human approval;
- rollback plan;
- incident record.

After verification, the fix must be reconciled back into the applicable stable, LTS, or enterprise maintenance line.
