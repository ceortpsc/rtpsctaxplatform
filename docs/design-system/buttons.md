# Buttons

Shared styles: `packages/ui-system/public/components.css` (`.btn`, `.btn--*`).  
Ross AI control plane keeps legacy `.btn.primary` / `.btn.ghost` class names mapped to the
same gold/navy tokens in `ross_ai/web/static/app.css`.

## Variants (ui-system)

| Class | Role |
|-------|------|
| `.btn--primary` | Primary CTA — `--grad-brand` |
| `.btn--secondary` | Secondary surface action |
| `.btn--tertiary` | Outlined quiet |
| `.btn--quiet` | Textual |
| `.btn--destructive` | Danger |
| `.btn--success` | Affirmative completion |
| `.btn--link` | Inline link style |

## Rules

- Min height ~40px; input text ≥ 16px on mobile.
- Loading: `.is-loading` (spinner, `pointer-events: none`).
- Disabled: opacity 0.45, `cursor: not-allowed`.
- One primary CTA per section.
