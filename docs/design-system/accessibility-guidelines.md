# Accessibility Guidelines

- Skip link to `#main` on Ross AI layout; add equivalent on other shells.
- `:focus-visible` gold outline; never remove focus styles.
- `prefers-reduced-motion: reduce` disables ambient/entrance motion.
- Status never by color alone (`STATUS_META` labels).
- Form errors associated with fields; live regions for flashes (`role="status"`).
- Icon-only controls need accessible names.
- High-contrast theme available via `data-theme="high-contrast"`.
- Auth pages: meaningful headings, autocomplete, CSRF tokens.
