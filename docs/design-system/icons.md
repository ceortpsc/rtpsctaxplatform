# Icons

## Brand icons / marks

SVG brand assets under `packages/ui-system/public/brand/`. Prefer monochrome or
navy/gold fills that respect currentColor when inlined.

## UI icons

No external icon pack. Operator UIs currently use compact text/glyphs in nav (modules
dashboard) or plain labels. When adding icons:

- Prefer inline SVG ≤ 24×24
- Provide accessible names (`aria-label` or visually hidden text)
- Never convey status by color/icon alone — pair with `STATUS_META` labels

## Illustrations

Empty / secure / success illustrations live in `public/illustrations/`
(`empty-*.svg`, `secure-login.svg`, `access-denied.svg`, `payment-success.svg`, etc.).
