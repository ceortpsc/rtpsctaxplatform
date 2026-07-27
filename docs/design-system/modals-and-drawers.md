# Modals and Drawers

## Tokens

- Overlay: `--color-overlay`
- Z: `--z-drawer` 40, `--z-overlay` 50, `--z-toast` 60
- Elevation: `--shadow-3`

## Patterns in repo

- Modules dashboard **command palette** (`Ctrl/⌘+K`) — overlay search
- Mobile **sidebar drawer** in `shell.css` (`.app-shell__mobile-bar`)
- Toasts in invoice / refund / POS UIs (fixed bottom-right)

## Rules

- Trap focus in modal; restore on close.
- Esc closes; backdrop click optional but must not dismiss destructive confirms without intent.
- Provide visible close control with accessible name.
