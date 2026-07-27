# Charts

## Current state

No charting library. Modules dashboard **Insights** uses CSS bar fills and counts.
Analytics service (`:3003`) is metadata-only (no chart UI).

## Guidance when adding charts

- Prefer simple SVG/CSS bars compatible with print.
- Use semantic tones for series, not rainbow defaults.
- Provide data table alternative for accessibility.
- Respect `prefers-reduced-motion` (no continuous animated redraws).
