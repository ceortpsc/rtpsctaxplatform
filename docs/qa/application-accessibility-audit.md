# Application Accessibility Audit

**Date:** 2026-07-27  
**Scope:** RTPSC scaffold HTML surfaces + `@rtp/ui-system` tokens  
**Method:** Static inventory + code review (not a full WCAG lab audit)

## Summary

| Area | Rating | Notes |
|------|--------|-------|
| Focus styles | Good (tokens) | `:focus-visible` + gold ring in theme / Ross AI CSS |
| Skip link | Good (Ross AI) | Added `#main` skip link; presence has basic skip |
| Motion | Good | `prefers-reduced-motion` honored in theme + Ross AI |
| Color-only status | Partial | Status taxonomy requires labels; some legacy UIs may still use color-heavy tags |
| Form labels | Good (Ross AI) | Visible labels on gates; CSRF present |
| Contrast (dark navy/gold) | Acceptable target | Gold on navy needs verification for small text — prefer gold for accents, ink for body |
| High contrast theme | Available | `data-theme="high-contrast"` |
| Landmark structure | Partial | Ross AI has header/nav/main/footer; some service UIs are flatter |
| Live regions | Partial | Flashes use `role="status"`; WS feed not fully announced |
| Keyboard / palette | Partial | Modules dashboard Ctrl+K; service UIs vary |

## Findings by surface

### Ross AI `:8787`

- **Pass:** Skip link, sticky topbar nav, gate forms with autocomplete, secure-access copy.
- **Pass:** Reduced motion disables atmosphere drift / rise animations.
- **Watch:** Topbar link density on small screens — wraps but may need overflow menu later.
- **Watch:** Execute console output is preformatted; ensure focus order after run.

### Modules dashboard `:3010`

- Sidebar nav buttons; command palette.
- Design System view still references “Sovereign Ledger” metaphor — visual migration to navy/slate ongoing via shared theme files where linked.
- Ensure view switches update document title / aria-current (improvement opportunity).

### Invoice / Refund / POS / Enrollment

- Functional operator forms; cream local CSS still present in several `public/styles.css` files (visual debt, not necessarily a11y blockers).
- Toast patterns should use polite live regions.

### API-only services

- N/A for page a11y (`:3000`, `:3002`, `:3003`, `:8820`).

## Priority remediation

1. Ensure every interactive HTML shell includes a skip link and `main` landmark.
2. Migrate remaining cream service CSS to `@rtp/ui-system` tokens (contrast consistency).
3. Add `aria-current="page"` / view announcements on SPA view switches.
4. Pair every status chip with visible text from `STATUS_META`.
5. Run axe or similar on `:3010`, `:8787`, `:3005`, `:3006` before production cutover.

## Out of scope / honesty

This scaffold is not production-certified for WCAG 2.2 AA. Treat this audit as a living
checklist for the unification effort, not a compliance certificate.
