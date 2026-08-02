# Application Accessibility Audit

Scope: upgraded RTPSC surfaces using `@rtp/ui-design-system`.

## Implemented

- Skip navigation link on staff-portal and invoice
- `aria-live` toast regions
- Focus-visible rings on buttons/inputs (`--ring-gold`)
- `prefers-reduced-motion` collapse in `theme.css`
- Minimum 16px input text (`--fs-lg`)
- Semantic headings in page headers
- Status badges with non-color dot indicators
- Modal/drawer escape handling in `shell.js`

## Remaining gaps

- Full keyboard trap audit on all modals per service
- Screen-reader walkthrough of POS tab interface
- Chart accessible fallbacks (no charts in current upgraded pages)
- WCAG 2.2 AA formal certification not claimed

## Recommendation

Run automated axe-core scans in CI when added; manual keyboard-only pass before production cutover.
