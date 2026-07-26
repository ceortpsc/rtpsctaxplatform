import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  listCanvasKinds,
  getCanvasKind,
  buildCanvasState,
  renderCanvasSource,
  createCanvas,
  createAllCanvases,
  listCanvasFiles,
  describeCanvasSurface
} from '../packages/canvas-core/src/index.mjs';

test('lists built-in canvas kinds', () => {
  const kinds = listCanvasKinds();
  assert.equal(kinds.length, 4);
  assert.deepEqual(
    kinds.map((k) => k.id).sort(),
    ['agents', 'compliance', 'modules', 'platform']
  );
  assert.equal(getCanvasKind('platform')?.fileName, 'platform.canvas.tsx');
  assert.equal(getCanvasKind('nope'), null);
});

test('buildCanvasState produces serializable snapshots', () => {
  for (const kind of listCanvasKinds()) {
    const state = buildCanvasState(kind.id, { generatedAt: '2026-07-26T00:00:00.000Z' });
    assert.equal(state.kind, kind.id);
    assert.equal(state.abbreviation, 'RTPSC');
    assert.equal(state.generatedAt, '2026-07-26T00:00:00.000Z');
    JSON.stringify(state);
  }
  const platform = buildCanvasState('platform');
  assert.ok(platform.totalModules > 0);
  assert.ok(Array.isArray(platform.categoryCounts));
  assert.ok(typeof platform.environment.protected === 'boolean');
});

test('renderCanvasSource emits cursor/canvas imports and STATE', () => {
  const state = buildCanvasState('agents', { generatedAt: '2026-07-26T00:00:00.000Z' });
  const source = renderCanvasSource('agents', state);
  assert.match(source, /from 'cursor\/canvas'/);
  assert.match(source, /const STATE =/);
  assert.match(source, /export default function AgentsCanvas/);
  assert.doesNotMatch(source, /from ['"]react['"]/);
});

test('createCanvas writes .canvas.tsx files', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rtpsc-canvas-'));
  try {
    const created = await createCanvas('platform', { dir, generatedAt: '2026-07-26T00:00:00.000Z' });
    assert.equal(created.fileName, 'platform.canvas.tsx');
    const body = await readFile(created.path, 'utf8');
    assert.match(body, /RTPSC Platform Constellation/);
    assert.match(body, /from 'cursor\/canvas'/);

    const all = await createAllCanvases({ dir });
    assert.equal(all.length, 4);
    const listed = await listCanvasFiles(dir);
    assert.equal(listed.length, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('describeCanvasSurface exposes CLI commands', () => {
  const surface = describeCanvasSurface();
  assert.equal(surface.package, '@rtp/canvas-core');
  assert.ok(surface.commands.some((c) => c.includes('canvas create')));
});

test('unknown kind rejects', async () => {
  await assert.rejects(() => createCanvas('not-a-kind'), /Unknown canvas kind/);
});
