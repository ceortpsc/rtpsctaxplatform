# @rtp/release-core

Canonical release-channel policy for **Ross Tax Pro Software Co Platform v2.0**.

## Active development identity

- Public tag: `v2.0-dev`
- Internal SemVer: `2.0.0-dev.0`
- Production eligibility: no

## Public channels

| Channel | Internal SemVer | Purpose |
|---|---|---|
| `v2.0-dev` | `2.0.0-dev.0` | Developer build |
| `v2.0-alpha` | `2.0.0-alpha.0` | Early unstable build |
| `v2.0-beta` | `2.0.0-beta.0` | Feature-complete but not final |
| `v2.0-rc1` | `2.0.0-rc.1` | Release candidate |
| `v2.0-stable` | `2.0.0` | Final production profile |
| `v2.0-lts` | `2.0.0+rtpsc.lts` | Long-term support profile |
| `v2.0-enterprise` | `2.0.0+rtpsc.enterprise` | Enterprise-grade profile |
| `v2.0-hotfix` | `2.0.1-hotfix.0` | Emergency patch profile |

A public channel name is not proof that a production release occurred. Production-eligible profiles remain subject to their required evidence gates, human approval, environment controls, signed artifacts, deployment receipts, and rollback evidence.

## API

```js
import {
  activeRelease,
  createReleaseManifest,
  evaluatePromotion,
  listReleaseChannels,
  validateReleaseCatalog
} from '@rtp/release-core';
```

## CLI

```bash
./rtpsc version
./rtpsc release list
./rtpsc release validate all
./rtpsc release build all --clean
./rtpsc release promote rc1 stable --evidence lint,test,build,qa-regression,security-review,compliance-review,human-approval,rollback-plan,artifact-signing
```

The promotion command evaluates evidence only. It does not create a Git tag, merge code, deploy infrastructure, or claim external production activation.
