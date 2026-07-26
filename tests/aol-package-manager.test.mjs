import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, lstat, readlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { install } from '../tools/aol/src/install.mjs';
import { discoverWorkspaces, loadRootManifest, workspaceByName } from '../tools/aol/src/workspaces.mjs';
import { buildLockfile, fingerprint, lockMatches, readLockfile } from '../tools/aol/src/lockfile.mjs';
import { runCli } from '../tools/aol/src/cli.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aol-fixture-'));
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture-root',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*'],
        scripts: { hello: 'node -e "console.log(\'hello-root\')"' }
      },
      null,
      2
    )
  );
  await mkdir(path.join(root, 'packages/alpha'), { recursive: true });
  await mkdir(path.join(root, 'packages/beta'), { recursive: true });
  await writeFile(
    path.join(root, 'packages/alpha/package.json'),
    JSON.stringify({ name: '@fix/alpha', version: '0.1.0', private: true, scripts: { ping: 'node -e "console.log(\'pong\')"' } }, null, 2)
  );
  await writeFile(
    path.join(root, 'packages/beta/package.json'),
    JSON.stringify({ name: '@fix/beta', version: '0.2.0', private: true }, null, 2)
  );
  return root;
}

describe('AOL package manager', () => {
  it('discovers workspaces from globs', async () => {
    const root = await makeFixture();
    try {
      const manifest = await loadRootManifest(root);
      const workspaces = await discoverWorkspaces(root, manifest.workspaces);
      assert.equal(workspaces.length, 2);
      assert.ok(workspaceByName(workspaces, '@fix/alpha'));
      assert.ok(workspaceByName(workspaces, '@fix/beta'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('installs parallel workspace links and writes RTPSC-package-lock.json', async () => {
    const root = await makeFixture();
    try {
      const result = await install(root, { quiet: true, force: true });
      assert.equal(result.linked, 2);
      assert.equal(result.cached, false);
      assert.equal(result.lockfile, 'RTPSC-package-lock.json');

      const alphaLink = path.join(root, 'node_modules/@fix/alpha');
      const st = await lstat(alphaLink);
      assert.equal(st.isSymbolicLink(), true);
      const target = await readlink(alphaLink);
      assert.match(target, /alpha/);

      const lock = JSON.parse(await readFile(path.join(root, 'RTPSC-package-lock.json'), 'utf8'));
      assert.equal(lock.lockfileVersion, 2);
      assert.equal(lock.lockfileFormat, 'RTPSC-package-lock');
      assert.ok(lock.packages['@fix/alpha'].integrity.startsWith('sha256-'));
      assert.ok(lock.packages['@fix/beta']);
      assert.ok(lock.sectors.packages.includes('@fix/alpha'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('cache-hits when fingerprints and links are healthy', async () => {
    const root = await makeFixture();
    try {
      await install(root, { quiet: true, force: true });
      const second = await install(root, { quiet: true });
      assert.equal(second.cached, true);
      assert.ok(second.ms < 100);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('builds matching lock fingerprints', async () => {
    const root = await makeFixture();
    try {
      const manifest = await loadRootManifest(root);
      const workspaces = await discoverWorkspaces(root, manifest.workspaces);
      const lock = buildLockfile({ rootName: manifest.name, rootVersion: manifest.version, workspaces });
      assert.equal(lockMatches(lock, workspaces), true);
      workspaces[0].version = '9.9.9';
      assert.equal(lockMatches(lock, workspaces), false);
      assert.equal(fingerprint(workspaces[0]).length, 16);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('cli help and version exit 0', async () => {
    const help = await runCli(['help']);
    const version = await runCli(['version']);
    assert.equal(help, 0);
    assert.equal(version, 0);
  });

  it('reads lockfile after install', async () => {
    const root = await makeFixture();
    try {
      await install(root, { quiet: true, force: true });
      const lock = await readLockfile(root);
      assert.equal(lock.generator, 'aol@0.1.0');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
