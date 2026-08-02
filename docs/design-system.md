# RTPSC "Signal Era" Design System

A new-era tech visual language for the RTPSC Tax Platform. The concept: make a
compliance-heavy tax platform feel precise, modern, and signal-clear — like a
next-generation transmission control surface, not an engraved certificate.

## Concept

- **Metaphor:** the *Signal Era* — precision e-file infrastructure with clear
  status, geometry, and motion.
- **Feeling:** technical craftsmanship, institutional trust without nostalgia;
  "built for the next transmission era."
- **Motifs:** constellation/node charts, soft orbit rings, cool mist fields,
  electric signal azure on graphite ink.
- **Rejected:** Sovereign Ledger cream · gold · serif look (not approved).

## Palette

| Token | Hex | Role |
|-------|-----|------|
| Mist (base) | `#e4ecf4` | Page background |
| Mist 100 | `#eef3f8` | Secondary surfaces |
| White | `#ffffff` | Panels |
| Signal | `#0a7ea4` | Primary accent |
| Signal bright | `#1a9bc7` | Highlights |
| Graphite (ink) | `#0b1220` | Primary text |
| Graphite 600 | `#243044` | Secondary ink |
| Steel | `#5b6b7c` | Muted / secondary text |

## Architecture / layout

- **App shell:** fixed 264px sidebar (emblem + navigation) beside a fluid main
  column with a sticky titled topbar.
- **Background:** `--grad-hero` cool mist wash + soft orbit motifs + drifting
  lattice grid.
- **Public hero:** full-bleed brand plane (RTPSC first), one headline, one
  supporting sentence, CTA group — no cards in the first viewport.
- **Views:** Catalog, Insights, AI Assistant, Dependency Graph, Design System.

## Tokens

All tokens live in `packages/ui-design-system/public/theme.css`. Legacy
`--cream-*` / `--gold-*` / `--color-gold` / `--color-navy` names are remapped to
Signal Era values so existing surfaces inherit the new look.

Typography: **Syne** (display) · **DM Sans** (UI) · **IBM Plex Mono** (code).

## Motion

- Entrances: `fade-rise`; lists use staggered reveals.
- Signal shimmer sweeps on primary surfaces.
- Soft float on brand marks; lattice grid drift.
- Accessibility: collapses under `prefers-reduced-motion: reduce`.

## Concept artwork

- `emblem.svg` — rounded chassis with rising signal constellation + RTPSC mark.
- `guilloche.svg` — orbit/lattice motif (replaces currency-style rosette).

Explore live: `./rtpsc start dashboard` → **Design System**, or staff portal
`/design-system`.
