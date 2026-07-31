# Signal Era Design System — Overview

The RTPSC **Signal Era** design system provides a unified new-era tech visual
language across operator and public surfaces. It replaces the rejected
**Sovereign Ledger** (cream · gold · serif) look.

## Package

`@rtp/ui-design-system` — dependency-free CSS/JS/assets served at `/rtp-design/*`.

## Themes

- **Light** (default): mist base, graphite ink, signal azure accent
- **Dark** (`data-theme="midnight"`): cool graphite canvas, signal highlights
- **Print**: `@media print` rules in `components.css`

## Core files

| File | Purpose |
|------|---------|
| `theme.css` | Design tokens (+ legacy name remaps) |
| `components.css` | Buttons, forms, tables, cards, status, modals |
| `shell.css` | App shell, sidebar, topbar, responsive |
| `shell.js` | Theme toggle, mobile nav, toasts |

## Brand assets (Signal Era)

Motif: **rising-signal constellation** on a graphite chassis — not generic letter tiles.

`public/brand/logos/`, `public/brand/brand.css`, `public/illustrations/`, `public/patterns/`  
Canonical copies: `assets/logos/`

| Ext | MIME | Notes |
|-----|------|-------|
| `.svg` | `image/svg+xml` | Vector source (monogram, wordmark, stacked lockup) |
| `.png` | `image/png` | Raster download (incl. 256px master) |
| `.ico` | `image/x-icon` | Favicon |

Force download (keeps extension): `/rtp-design/brand/logos/rtpsc-monogram.png?download=1`  
Regenerate: `node scripts/generate-logo-assets.mjs` / `pnpm run logos:generate`  
Kit UI: staff portal Design System + modules-dashboard Design System view.,
`public/assets/{emblem,guilloche}.svg`

## Showcase

- `http://localhost:3012/design-system` (staff-portal)
- `http://localhost:3010` → Design System view (modules-dashboard)
- `http://localhost:3011` (web-portal Signal Era marketing hero)

See also: `docs/design-system.md`.
