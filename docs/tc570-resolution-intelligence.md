# ROSS.CO TC 570 Resolution Intelligence System

## Purpose

This module systematically resolves the factual and procedural conditions commonly associated with TC 570 and related refund-integrity activity. It does not attempt to modify the Individual Master File, remove a transaction code, impersonate an IRS employee, or bypass a refund-integrity control.

## Resolution lanes

1. Identity theft or unauthorized return
2. Withholding verification / RIVO Withholding Only Work
3. Amended-return processing and TC 971/977 reconciliation
4. Examination control and statutory-rights preservation
5. Erroneous refund, cancellation or reversal
6. IRS or Treasury offset and credit transfer
7. Math-error or account adjustment
8. Unsupported or high-risk refundable credit
9. General processing hold

## Operating flow

`Notice intake → taxpayer authorization posture → approved transcript acquisition → return/Wage & Income/account reconciliation → resolution-lane classification → indexed evidence requirements → practitioner review → taxpayer approval → notice-authorized submission → receipt ledger → authoritative transaction monitoring`

## Required controls

- Mask taxpayer identifiers in logs.
- Treat the printed notice deadline as controlling.
- Classify each mismatch as taxpayer-verified, third-party reported, unauthorized-return entry, IRS adjustment, amended-return entry or unresolved.
- Map every TC 971/977 to a specific amended return.
- Map every TC 846/841/844/845 to a specific refund event.
- Do not claim withholding without reporting and reconciling the related income.
- Do not mark a refund as approved or issued from a bank-product estimate or non-authoritative status source.
- Do not auto-route to TAS without a current fact-specific eligibility check; restrictions may apply to certain RIVO and unreversed TC 810 cases.

## Authority matrix

| Issue | Current primary guidance |
|---|---|
| Freeze and account-condition research | IRM 21.5.6 |
| CP05A / withholding verification | IRM 25.25.11; IRC §§31 and 6402 |
| RIVO account resolution and refund release | IRM 25.25.13 |
| Erroneous refund and refund reversal | IRM 21.4.5; IRM 3.17.80 |
| Identity theft / preparer misconduct | IRS Form 14039 guidance; Forms 14157 and 14157-A; IRM 25.23 |
| Amended returns | IRM 21.5.3 and 21.5.6; IRC §§6402 and 6511 |
| Examination | IRM Part 4; IRC §§6212 and 6213 |
| Unsupported credits | IRC §§6001, 6676 and 6702; IRM 25.25.10 |
| TAS escalation | IRM 13.1.7 |

## Production use

```bash
pnpm --filter @rtp/tc570-resolution-intelligence test
```

```js
import { buildResolutionPlan } from '@rtp/tc570-resolution-intelligence';

const plan = buildResolutionPlan({
  taxYear: 2025,
  noticeCode: 'CP05B',
  returnData: { withholding: 11485 },
  wageIncome: { withholding: 8450 },
  account: { transactionCodes: [570] }
});
```

The output includes the controlling resolution lane, secondary issues, severity, evidence checklist, operational tasks, monitoring codes, prohibited actions and a SHA-256 integrity hash.
