import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildAllReleaseChannels } from '../scripts/build-release-channels.mjs';
import {
  loadReleaseConfig,
  resolveChannel
} from '../scripts/release-channel.mjs';

test('root package version matches the canonical default release channel', async () => {
  const config = loadReleaseConfig();
  const active = resolveChannel(config, config.defaultChannel);
  const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(config.defaultChannel, 'alpha');
  assert.equal(active.tag, 'v2.0-alpha');
  assert.equal(active.semanticVersion, '2.0.0-alpha.0');
  assert.equal(rootPackage.version, active.semanticVersion);
  assert.match(rootPackage.description, /v2\.0-alpha/);
});

test('all-channel builder emits deterministic governed evidence without deployment claims', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'rtpsc-release-'));
  const outputDir = path.join(tempRoot, 'releases');
  try {
    const result = await buildAllReleaseChannels({
      clean: true,
      outputDir,
      commitSha: 'abc123def456',
      sourceBranch: 'feature/release-test',
      repository: 'ceortpsc/rtpsctaxplatform',
      createdAt: '2026-07-31T09:00:00.000Z'
    });

    assert.equal(result.ok, true);
    assert.equal(result.channelCount, 8);
    assert.equal(result.defaultChannel, 'alpha');
    assert.equal(result.gitTagsCreated, false);
    assert.equal(result.githubReleasesCreated, false);
    assert.equal(result.externalRuntimeDeploymentClaimed, false);

    const config = loadReleaseConfig();
    for (const channel of config.channels) {
      const filename = `${channel.tag}.json`;
      await access(path.join(outputDir, filename));
      const manifest = JSON.parse(await readFile(path.join(outputDir, filename), 'utf8'));
      assert.equal(manifest.channel, channel.id);
      assert.equal(manifest.tag, channel.tag);
      assert.equal(manifest.semanticVersion, channel.semanticVersion);
      assert.equal(manifest.commitSha, 'abc123def456');
      assert.equal(manifest.sourceBranch, 'feature/release-test');
      assert.equal(manifest.repository, 'ceortpsc/rtpsctaxplatform');
      assert.equal(manifest.generatedAt, '2026-07-31T09:00:00.000Z');
    }

    const catalog = JSON.parse(await readFile(path.join(outputDir, 'catalog.json'), 'utf8'));
    assert.equal(catalog.channelCount, 8);
    assert.equal(catalog.defaultChannel, 'alpha');
    assert.equal(catalog.files.length, 8);

    const sums = (await readFile(path.join(outputDir, 'SHA256SUMS'), 'utf8')).trim().split('\n');
    assert.equal(sums.length, 9);
    for (const line of sums) assert.match(line, /^[a-f0-9]{64}  /);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
