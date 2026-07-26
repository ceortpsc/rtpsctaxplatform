---
name: rtpsc-canvas
description: Create RTPSC Cursor Canvases (platform constellation, compliance posture, development team, module catalog). Use when the user asks for a canvas, visual platform overview, compliance dashboard artifact, or agent roster view.
---

# RTPSC Canvas Creation

Generate interactive Cursor Canvases for the Ross Tax Pro Software Co tax platform.

## When to use

- User asks for a **canvas**, **visual overview**, **compliance canvas**, or **module catalog canvas**
- A table/markdown dump is a poor fit and a side-panel artifact would help
- Regenerating stale `.cursor/canvases/*.canvas.tsx` files from live platform state

## Preferred path (CLI)

```bash
./rtpsc canvas kinds
./rtpsc canvas create all
./rtpsc canvas create platform
./rtpsc canvas create compliance
./rtpsc canvas create agents
./rtpsc canvas create modules
./rtpsc canvas list
```

Canvases write to `.cursor/canvases/*.canvas.tsx` and open in the Cursor Agents Window
(**Open Canvas** / canvas tab). They import only from `cursor/canvas`.

## Package

- Generator: `@rtp/canvas-core` (`packages/canvas-core`)
- Docs: `docs/cursor-canvas.md`
- No external runtime npm dependencies — Node built-ins only for generation

## Layout rules for hand-authored or refined canvases

1. Import **only** from `cursor/canvas` (plus React hooks if needed).
2. Inline a `const STATE = { ... }` snapshot — do not fetch at render time.
3. Prefer `Stack`, `Row`, `Grid`, `Stat`, `Table`, `Card`, `Pill`, `H1`/`H2`, `Text`, `Divider`.
4. Keep the first viewport focused: brand/company, one title, key stats, then detail sections.
5. Regenerate via `./rtpsc canvas create <kind>` instead of inventing parallel generators.

## Kinds

| Kind | File | Purpose |
|------|------|---------|
| `platform` | `platform.canvas.tsx` | Modules, env protection, workflows |
| `compliance` | `compliance.canvas.tsx` | Scaffold gates + protection reasons |
| `agents` | `agents.canvas.tsx` | Deployment-assist development team |
| `modules` | `modules.canvas.tsx` | Full catalog by category |

## After creation

Tell the user the relative path(s) and that they can open the canvas from the Agents Window
or Command Palette → **Open Canvas**.
