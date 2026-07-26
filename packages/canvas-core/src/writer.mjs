import { mkdir, writeFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANVAS_KINDS, getCanvasKind, listCanvasKinds } from './kinds.mjs';
import { buildCanvasState } from './state.mjs';
import { renderCanvasSource } from './templates.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DEFAULT_CANVAS_DIR = path.join(repoRoot, '.cursor', 'canvases');

/** Resolve (and ensure) the canvas output directory. */
export async function ensureCanvasDir(dir = DEFAULT_CANVAS_DIR) {
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Create one canvas kind and write `.canvas.tsx` to disk. */
export async function createCanvas(kindId, options = {}) {
  const kind = getCanvasKind(kindId);
  if (!kind) {
    throw new Error(`Unknown canvas kind "${kindId}". Known: ${listCanvasKinds().map((k) => k.id).join(', ')}`);
  }
  const dir = await ensureCanvasDir(options.dir ?? DEFAULT_CANVAS_DIR);
  const state = buildCanvasState(kindId, options);
  const source = renderCanvasSource(kindId, state);
  const filePath = path.join(dir, kind.fileName);
  await writeFile(filePath, source, 'utf8');
  return {
    kind: kind.id,
    title: kind.title,
    fileName: kind.fileName,
    path: filePath,
    relativePath: path.relative(repoRoot, filePath),
    generatedAt: state.generatedAt,
    bytes: Buffer.byteLength(source, 'utf8')
  };
}

/** Create every built-in canvas kind. */
export async function createAllCanvases(options = {}) {
  const results = [];
  for (const kind of CANVAS_KINDS) {
    results.push(await createCanvas(kind.id, options));
  }
  return results;
}

/** List canvas files present on disk. */
export async function listCanvasFiles(dir = DEFAULT_CANVAS_DIR) {
  try {
    await access(dir);
  } catch {
    return [];
  }
  const entries = await readdir(dir);
  return entries
    .filter((name) => name.endsWith('.canvas.tsx'))
    .sort()
    .map((fileName) => {
      const kind = CANVAS_KINDS.find((k) => k.fileName === fileName) ?? null;
      return {
        fileName,
        path: path.join(dir, fileName),
        relativePath: path.relative(repoRoot, path.join(dir, fileName)),
        kind: kind?.id ?? null,
        title: kind?.title ?? fileName
      };
    });
}

/** Describe the canvas creation surface (kinds + default dir). */
export function describeCanvasSurface() {
  return {
    package: '@rtp/canvas-core',
    defaultDir: path.relative(repoRoot, DEFAULT_CANVAS_DIR),
    kinds: listCanvasKinds(),
    commands: [
      './rtpsc canvas list',
      './rtpsc canvas kinds',
      './rtpsc canvas create [platform|compliance|agents|modules|all]'
    ]
  };
}
