/**
 * @rtp/canvas-core — Cursor Canvas creation for the RTPSC Tax Platform.
 *
 * Generates self-contained `.canvas.tsx` artifacts under `.cursor/canvases/`
 * that render in the Cursor Agents Window via `cursor/canvas` components.
 * No external runtime npm deps; Node built-ins only for generation.
 */

export { CANVAS_KINDS, getCanvasKind, listCanvasKinds } from './kinds.mjs';
export { buildCanvasState } from './state.mjs';
export { renderCanvasSource } from './templates.mjs';
export {
  DEFAULT_CANVAS_DIR,
  ensureCanvasDir,
  createCanvas,
  createAllCanvases,
  listCanvasFiles,
  describeCanvasSurface
} from './writer.mjs';
