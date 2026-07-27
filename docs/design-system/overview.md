# Design System Overview

**Package:** `@rtp/ui-system` (`packages/ui-system`)  
**Brand:** RTPSC / Ross Tax Pro Software Co  
**Visual direction:** Institutional navy + gold on cool slate surfaces

## Purpose

Unify every RTPSC HTML surface — operator services, modules dashboard, Ross AI control
plane, and presence sites — under one token set, type stack, status taxonomy, and
navigation model. Replace per-module cream prototypes and unrelated accent themes
(forest green, cyan glow) with a single family.

## Architecture

```
packages/ui-system/
  public/theme.css       # primitives + semantic tokens (light/dark/print/HC/thermal)
  public/shell.css       # AppShell sidebar, command bar, mobile drawer
  public/components.css  # buttons, forms, tables, status, feedback
  public/brand/          # monogram, wordmark, favicon, seals, stamps, OG
  public/illustrations/  # empty / secure / success states
  public/patterns/       # subtle ledger / secure document patterns
  src/index.mjs          # ROLES, STATUS_TAXONOMY, NAVIGATION, resolveSharedPath
  src/serve.mjs          # shared asset serving helpers
```

Services that already mount `/shared/*` (via `tryServeShared`) can load
`/shared/theme.css`, `/shared/brand/...`, etc. Ross AI serves only `/static/*` from
`ross_ai/web/static/` — brand marks are copied under `ross_ai/web/static/brand/`.

## Themes

| `data-theme` | Use |
|--------------|-----|
| *(default light)* | Operator workspaces |
| `dark` / `midnight` | Control plane, late-shift ops |
| `high-contrast` | Accessibility |
| `print` / `mono-document` | PDF / print layouts |
| `thermal` | Receipt paper |

## Layout catalog (`PAGE_LAYOUTS`)

AppShell, AuthLayout, DashboardLayout, StandardPageLayout, FormPageLayout,
DataWorkspaceLayout, SplitViewLayout, DetailPageLayout, DocumentLayout, SettingsLayout,
ClientPortalLayout, FullScreenWorkflowLayout, PrintLayout.

## Related docs

See sibling files in this folder for color, type, spacing, elevation, radius, icons,
buttons, forms, tables, cards, navigation, modals, status, charts, page layouts,
responsive, accessibility, print, and content guidelines.
