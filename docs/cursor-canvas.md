# Cursor Canvas Creation (RTPSC)

Generate interactive **Cursor Canvases** from live RTPSC platform state. Canvases
are `.canvas.tsx` artifacts that render in the Cursor Agents Window beside chat.

## Quickstart

```bash
./rtpsc canvas kinds
./rtpsc canvas create all
./rtpsc canvas list
```

Output directory: `.cursor/canvases/`

Open in Cursor: Command Palette → **Open Canvas**, or the Agents Window canvas tab.

## Kinds

| Kind | File | Contents |
|------|------|----------|
| `platform` | `platform.canvas.tsx` | Module counts, env protection, workflows |
| `compliance` | `compliance.canvas.tsx` | Scaffold gates + protection reasons |
| `agents` | `agents.canvas.tsx` | Deployment-assist development team |
| `modules` | `modules.canvas.tsx` | Full catalog by category |

```bash
./rtpsc canvas create platform
./rtpsc canvas create compliance
./rtpsc canvas create agents
./rtpsc canvas create modules
```

## Package

`@rtp/canvas-core` (`packages/canvas-core`) — Node built-ins only.

- `buildCanvasState(kind)` — serializable snapshot
- `createCanvas(kind)` / `createAllCanvases()` — write `.canvas.tsx`
- `listCanvasKinds()` / `listCanvasFiles()` / `describeCanvasSurface()`

Generated sources import **only** from `cursor/canvas` (provided by the Cursor IDE).
They are not a runtime product dependency and do not require npm packages to generate.

## Agent skill

Project skill: `.cursor/skills/rtpsc-canvas/SKILL.md`

Ask the agent for a platform/compliance/module canvas, or run the CLI above.

## Related

- Cursor docs: [Canvases](https://cursor.com/docs/agent/tools/canvas)
- Modules dashboard (product UI graph): `pnpm run start:dashboard` → port `3010`
- Agents tooling: `./rtpsc agents`
