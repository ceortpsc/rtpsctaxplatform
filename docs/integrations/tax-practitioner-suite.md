# IRS Tax Practitioner Suite (ERO)

ERO-facing tax practitioner account interface integrating API client, TDS client,
IRS OAuth posture, masterfile TC **570** / **810** rectification, refund
intelligence, AI assist, custom XHTML/XML, and refund release → reconcile.

## Run

```bash
./rtpsc practitioner lifecycle --json
./rtpsc workflow run refund-release-after-tc-rectify '{"caseId":"UF-2026-001","taxpayerRef":"TP-UF-001","amount":3200,"rectifyCodes":["570","810"]}'
./rtpsc workflow emit masterfile.tc.rectified '{"caseId":"UF-2026-001","taxpayerRef":"TP-UF-001","amount":3200}'
./rtpsc start practitioner   # http://127.0.0.1:8880
./rtpsc start irs            # IRS OAuth gateway :8820
```

## Modules

| Module | Role |
|---|---|
| `@rtp/irs-practitioner` | Suite facade |
| `@rtp/irs-practitioner-service` | ERO UI + APIs `:8880` |
| `@rtp/irs-xml` | XHTML/XML builders |
| `@rtp/refund-release-core` | Request / approve / issue / reconcile |
| `@rtp/tc-code-engine` | TC catalog + 570/810 rectify |
| `@rtp/masterfile-pipeline` | Process + gate |
| `@rtp/refund-release-workflow` | Event triggers |
| `@rtp/refund-intelligence-engine` + `@rtp/ai-assist` | Scoring + guidance |

## Fail-safe

Live IRS 846 issuance stays **scaffold-only** until production environment
protection clears (`EFILE_TRANSMISSION_ENABLED`, secrets, approved tunnel).
Artifacts: `logs/operational/practitioner-release-lifecycle.json`.
