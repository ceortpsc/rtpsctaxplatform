import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { install, listFootprints, FOOTPRINTS_FILE } from '../tools/aol/src/index.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aol-fp-'));
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fp-root', version: '1.0.0', private: true, workspaces: ['packages/*'] }, null, 2)
  );
  await mkdir(path.join(root, 'packages/a'), { recursive: true });
  await mkdir(path.join(root, 'packages/b'), { recursive: true });
  await writeFile(
    path.join(root, 'packages/a/package.json'),
    JSON.stringify({ name: '@rtp/a', version: '0.1.0', private: true }, null, 2)
  );
  await writeFile(
    path.join(root, 'packages/b/package.json'),
    JSON.stringify({ name: '@rtp/b', version: '0.2.0', private: true }, null, 2)
  );
  return root;
}

describe('All footprints', () => {
  it('lists every workspace footprint after install', async () => {
    const root = await makeFixture();
    try {
      await install(root, { quiet: true, force: true });
      const report = await listFootprints(root);
      assert.equal(report.count, 2);
      assert.equal(report.sealed, 2);
      assert.equal(report.ok, true);
      assert.ok(report.footprints.every((e) => e.footprint.length === 16));
      assert.ok(report.footprints.every((e) => e.integrity.startsWith('sha256-')));
      assert.deepEqual(
        report.footprints.map((e) => e.name).sort(),
        ['@rtp/a', '@rtp/b']
      );

      const ledger = JSON.parse(await readFile(path.join(root, FOOTPRINTS_FILE), 'utf8'));
      assert.equal(ledger.count, 2);
      assert.equal(ledger.lockfile, 'RTPSC-package-lock.json');
      assert.equal(ledger.footprints.length, 2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('detects drift when a package.json changes after seal', async () => {
    const root = await makeFixture();
    try {
      await install(root, { quiet: true, force: true });
      await writeFile(
        path.join(root, 'packages/a/package.json'),
        JSON.stringify({ name: '@rtp/a', version: '9.9.9', private: true }, null, 2)
      );
      const report = await listFootprints(root);
      assert.equal(report.drift, 1);
      assert.equal(report.ok, false);
      assert.equal(report.footprints.find((e) => e.name === '@rtp/a').status, 'drift');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
