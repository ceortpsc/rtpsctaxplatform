# Status System

Source: `STATUS_TAXONOMY` + `STATUS_META` in `@rtp/ui-system`.

## Groups

| Group | Codes |
|-------|-------|
| general | active, inactive, draft, pending, complete, archived |
| approval | not_submitted, submitted, changes_requested, approved, rejected |
| payment | unpaid, partially_paid, paid, past_due, refunded, reversed, failed |
| document | missing, requested, received, under_review, accepted, rejected, expired |
| tax_return | intake → closed (incl. transmitted, accepted, rejected, amended) |
| security | verified, unverified, restricted, locked, suspended, revoked |

Each code has `{ label, tone, group }` where tone ∈ success | warning | danger | info | neutral.

**Rule:** never use color alone — always show the text label (`statusLabel(code)`).
