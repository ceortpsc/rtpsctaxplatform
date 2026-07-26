# RTPSC "Sovereign Ledger" Design System

A treasury-grade visual language for the RTPSC Tax Platform modules dashboard. The
concept: make a compliance-heavy tax platform *feel* authoritative, premium, and
trustworthy — like an engraved certificate or a national mint's ledger.

## Concept

- **Metaphor:** the *Sovereign Ledger* — an official, embossed financial register.
- **Feeling:** considered, official, unmistakably premium; "a great idea, executed with care."
- **Motifs:** guilloché security engraving (currency/certificates), an embossed seal/crest,
  ascending ledger bars (growth), and gold that behaves like light on metal.

## Palette

| Token | Hex | Role |
|-------|-----|------|
| Cream (base) | `#f1e8d2` | Page background |
| Cream 100 | `#f8f2e2` | Secondary surfaces |
| White | `#ffffff` | Cards / panels |
| Gold | `#b8860b` | Primary accent (dark goldenrod) |
| Gold bright | `#d4af37` | Highlights / metallic sheen |
| Navy (ink) | `#14213d` | Primary text |
| Navy 500 | `#22345f` | Secondary ink / edges |
| Black trim | `#16181d` | Crisp element outlines |
| Silver | `#9aa1ac` | Muted / secondary text |

## Architecture / layout

- **App shell:** fixed 264px sidebar (emblem + navigation + command-palette hint) beside a
  fluid main column with a sticky, titled topbar and per-view kicker.
- **Background:** a `--grad-hero` radial wash over cream, plus two slowly rotating guilloché
  rosettes anchored to opposite corners (decorative, `pointer-events:none`).
- **Views:** Catalog, Insights, AI Assistant, Dependency Graph, and a Design System showcase.
- **Command palette:** `Ctrl/⌘+K` overlay with keyboard navigation.

## Tokens

All tokens live in `public/theme.css`: color primitives + semantic surfaces, gradients/sheens,
a serif/sans/mono type stack with a modular type scale, a 4px spacing scale, radii, three
elevation shadows plus a gold glow, and motion tokens (durations + easings). Application styles
in `public/styles.css` consume only these tokens.

## Motion

- Entrances: `fade-rise`; lists use staggered reveals via a small JS orchestrator.
- Metallic: gold **shimmer** sweeps on primary buttons and skeleton bars.
- Data: bars grow to value; stat numbers **count up**.
- Ambient: guilloché rosettes **spin** very slowly; the emblem **floats**.
- Graph: `drives` edges have a flowing dashed stroke.
- Accessibility: everything collapses under `prefers-reduced-motion: reduce`.

## Concept artwork

Original, dependency-free SVGs in `public/assets/`:

- `emblem.svg` — a seal crest: navy field, milled coin edge (dashed ring), a shield with
  ascending ledger bars, an ascent chevron, a crown star, and curved seal text via `textPath`.
- `guilloche.svg` — a currency-style rosette of overlapping, rotated ellipses with a radial
  gold fade; used as the decorative background and design-artwork motif.

Explore it live: `pnpm run start:dashboard` → open `http://localhost:3010` → **Design System**.
