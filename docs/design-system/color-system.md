# Color System

Source of truth: `packages/ui-system/public/theme.css`.

## Primitives

**Slate:** 50→900 (`#f7f8fb` … `#0f1726`) — cool surfaces  
**Navy:** 500→900 (`#24386a` … `#081022`) — institutional ink / brand  
**Gold:** 300→700 (`#e6c979` … `#6b5400`) — accent / focus / CTA sheen  

**Semantic tones:** success `#1f7a4d`, warning `#9a6700`, danger `#b42318`, info `#175cd3`
(each with a `*-100` / translucent dark background pair).

## Semantic tokens (light default)

| Token | Role |
|-------|------|
| `--color-bg` | Page background (slate-50) |
| `--color-surface` | Panels / elevated cards |
| `--color-ink` | Primary text (navy-900) |
| `--color-muted` | Secondary text |
| `--color-line` | Borders |
| `--color-gold` | Accent |
| `--color-focus` | Focus ring |
| `--color-sidebar` | App shell sidebar |

Dark (`data-theme="dark"`): bg `#0b1220`, surfaces `#141e31`, ink `#eef2f8` — same family
as Ross AI control plane after unification.

## Gradients

`--grad-brand`, `--grad-gold`, `--grad-navy`, `--grad-hero` (subtle gold + navy radials).

## Deprecated local palettes

Per-service cream (`#f1e8d2`) sheets and Ross AI forest green (`#07120e` / `#1f6f54`) are
legacy; migrate to these tokens.
