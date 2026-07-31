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

## Brand assets

`public/brand/logos/`, `public/illustrations/`, `public/patterns/`,
`public/assets/{emblem,guilloche}.svg`

## Showcase

- `http://localhost:3012/design-system` (staff-portal)
- `http://localhost:3010` → Design System view (modules-dashboard)
- `http://localhost:3011` (web-portal Signal Era marketing hero)

See also: `docs/design-system.md`.
