# RTPSC Enterprise Design System

> **Canonical overview:** [`docs/design-system/overview.md`](design-system/overview.md)

This document is the entry point for the **application-wide UI unification**. The platform
is moving away from cream-only “Sovereign Ledger” prototype fragmentation (per-service
local cream palettes, forest-green Ross AI, cyan presence glow) toward a single
**institutional navy + gold on cool slate** family owned by `@rtp/ui-system`.

## Where tokens live

| Asset | Path |
|-------|------|
| Theme tokens | `packages/ui-system/public/theme.css` |
| App shell | `packages/ui-system/public/shell.css` |
| Components | `packages/ui-system/public/components.css` |
| Brand SVGs | `packages/ui-system/public/brand/**` |
| JS catalog / roles / status | `packages/ui-system/src/index.mjs` |

Operator UIs (modules dashboard, invoice, refund, POS/CRM, enrollment) and the Ross AI
control plane (`:8787`) should consume the same primitives. Dark default is acceptable for
the control plane; light slate is the default for operator workspaces.

## Doc suite

- Product: `docs/product/` — route inventory, page inventory, role-route matrix
- Design system: `docs/design-system/` — tokens, patterns, components, a11y, print
- QA: `docs/qa/` — accessibility audit, page-upgrade completion matrix
- Engineering: `docs/engineering/application-security-review.md`

## Honesty note

This scaffold includes operator shells and stubs — not a complete production tax-return
e-file product. Navigation items marked `implemented: false` in `@rtp/ui-system` are
intentionally unavailable.
