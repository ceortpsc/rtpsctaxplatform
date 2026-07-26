/** Built-in Cursor Canvas kinds for the RTPSC platform. */

export const CANVAS_KINDS = Object.freeze([
  Object.freeze({
    id: 'platform',
    title: 'Platform Constellation',
    description: 'Module inventory, environment protection, and workflow posture.',
    fileName: 'platform.canvas.tsx'
  }),
  Object.freeze({
    id: 'compliance',
    title: 'Compliance Posture',
    description: 'Production compliance scaffold gates and overall readiness.',
    fileName: 'compliance.canvas.tsx'
  }),
  Object.freeze({
    id: 'agents',
    title: 'Development Team',
    description: 'Deployment-assist agent roster and focus areas.',
    fileName: 'agents.canvas.tsx'
  }),
  Object.freeze({
    id: 'modules',
    title: 'Module Catalog',
    description: 'Category breakdown with tags and dependency hints.',
    fileName: 'modules.canvas.tsx'
  })
]);

export function getCanvasKind(id) {
  return CANVAS_KINDS.find((kind) => kind.id === id) ?? null;
}

export function listCanvasKinds() {
  return [...CANVAS_KINDS];
}
