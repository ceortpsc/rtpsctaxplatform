# Navigation

Central model: `NAVIGATION` in `packages/ui-system/src/index.mjs`.

## Sections

Overview · Client Operations · Tax Operations · Financial Operations · Workflow ·
Administration · Platform · Support

Items with `implemented: false` must not appear as available destinations (may show as
limited/unavailable in future shells).

## Role filtering

`navigationForRole(role)`:

- **client** — only `dashboard`, `documents`, `invoices`, `payments`, `help`
- **read_only_auditor** — implemented items except `ai_workforce`, `pos`, `execute`
- others — all implemented items

## Shells

- **App shell sidebar** — operator UIs (`shell.css`)
- **Ross AI topbar** — control plane primary nav + auth CTAs
- **Modules dashboard** — local view buttons (catalog, insights, assistant, graph, status, design)
