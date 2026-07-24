import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  install,
  buildLockfile,
  readLockfile,
  validateLockfile,
  LOCKFILE_NAME,
  LOCKFILE_VERSION,
  LEGACY_LOCKFILE_NAME,
  integrity,
  fingerprint
} from '../tools/aol/src/index.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rtpsc-lock-'));
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'rtpsc-fixture',
        version: '0.1.0',
        private: true,
        workspaces: ['packages/*']
      },
      null,
      2
    )
  );
  await mkdir(path.join(root, 'packages/core'), { recursive: true });
  await writeFile(
    path.join(root, 'packages/core/package.json'),
    JSON.stringify({ name: '@rtp/core', version: '0.1.0', private: true, scripts: { test: 'node -e "1"' } }, null, 2)
  );
  return root;
}

describe('RTPSC-package-lock.json', () => {
  it('seals v2 lock with integrity, sectors, and RTPSC metadata', async () => {
    const root = await makeFixture();
    try {
      const result = await install(root, { quiet: true, force: true });
      assert.equal(result.lockfile, LOCKFILE_NAME);

      const raw = JSON.parse(await readFile(path.join(root, LOCKFILE_NAME), 'utf8'));
      assert.equal(raw.lockfileFormat, 'RTPSC-package-lock');
      assert.equal(raw.lockfileVersion, LOCKFILE_VERSION);
      assert.equal(raw.platform, 'rtpsctaxplatform');
      assert.equal(raw.packageManager, 'aol@0.1.0');
      assert.match(raw.copyright, /RTPSC/);
      assert.match(raw.disclaimer, /America Online/);
      assert.equal(raw.stats.workspaceCount, 1);
      assert.deepEqual(raw.sectors.packages, ['@rtp/core']);

      const pkg = raw.packages['@rtp/core'];
      assert.equal(pkg.fingerprint, fingerprint({
        name: pkg.name,
        version: pkg.version,
        location: pkg.location,
        dependencies: {},
        devDependencies: {},
        scripts: { test: 'node -e "1"' }
      }));
      assert.equal(pkg.integrity, integrity({
        name: pkg.name,
        version: pkg.version,
        location: pkg.location,
        dependencies: {},
        devDependencies: {},
        scripts: { test: 'node -e "1"' }
      }));

      const validation = validateLockfile(raw);
      assert.equal(validation.ok, true);

      // legacy file should not remain after seal
      await assert.rejects(() => access(path.join(root, LEGACY_LOCKFILE_NAME)));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reads legacy aol.lock.json and still matches fingerprints', async () => {
    const root = await makeFixture();
    try {
      const workspaces = [
        {
          name: '@rtp/core',
          version: '0.1.0',
          location: 'packages/core',
          private: true,
          scripts: { test: 'node -e "1"' },
          dependencies: {},
          devDependencies: {},
          dir: path.join(root, 'packages/core')
        }
      ];
      const legacy = {
        name: 'rtpsc-fixture',
        version: '0.1.0',
        lockfileVersion: 1,
        generator: 'aol@0.1.0',
        packages: {
          '@rtp/core': {
            version: '0.1.0',
            location: 'packages/core',
            link: true,
            fingerprint: fingerprint(workspaces[0])
          }
        }
      };
      await writeFile(path.join(root, LEGACY_LOCKFILE_NAME), `${JSON.stringify(legacy, null, 2)}\n`);
      const lock = await readLockfile(root);
      assert.equal(lock._source, LEGACY_LOCKFILE_NAME);
      assert.equal(lock.packages['@rtp/core'].fingerprint, fingerprint(workspaces[0]));

      // upgrading install replaces with canonical RTPSC lock
      await install(root, { quiet: true, force: true });
      const upgraded = await readLockfile(root);
      assert.equal(upgraded._source, LOCKFILE_NAME);
      assert.equal(upgraded.lockfileVersion, 2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('buildLockfile emits schema-shaped document', () => {
    const lock = buildLockfile({
      rootName: 'demo',
      rootVersion: '1.0.0',
      workspaces: [
        {
          name: '@rtp/x',
          version: '0.0.1',
          location: 'services/x',
          private: true,
          scripts: {},
          dependencies: {},
          devDependencies: {}
        }
      ],
      config: { install: { lockfile: LOCKFILE_NAME }, brand: { aesthetic: 'instant-messenger-signal' } }
    });
    assert.equal(lock.lockfileFormat, 'RTPSC-package-lock');
    assert.equal(lock.sectors.services[0], '@rtp/x');
    assert.equal(validateLockfile(lock).ok, true);
  });
});
