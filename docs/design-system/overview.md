# Sovereign Ledger Design System — Overview

The RTPSC **Sovereign Ledger** design system provides a unified enterprise visual language across all operator and public surfaces.

## Package

`@rtp/ui-design-system` — dependency-free CSS/JS/assets served at `/rtp-design/*`.

## Themes

- **Light** (default): cream base, navy ink, gold accent
- **Dark** (`data-theme="midnight"`): deep navy canvas, gold highlights
- **Print**: `@media print` rules in `components.css`

## Core files

| File | Purpose |
|------|---------|
| `theme.css` | Design tokens |
| `components.css` | Buttons, forms, tables, cards, status, modals |
| `shell.css` | App shell, sidebar, topbar, responsive |
| `shell.js` | Theme toggle, mobile nav, toasts |

## Brand assets

`public/brand/logos/`, `public/illustrations/`, `public/patterns/`

## Showcase

`http://localhost:3012/design-system` (staff-portal)

See also: `docs/design-system.md` (modules-dashboard origin doc).
