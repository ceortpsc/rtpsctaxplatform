import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  describeChannels,
  formatReleaseTag,
  isProductionEligible,
  listChannels,
  loadChannelCatalog,
  parseReleaseToken,
  releaseMetadataBlock,
  resolvePlatformRelease,
  resolvePlatformReleaseSync,
  stampPlatformRelease
} from '../packages/platform-version/src/index.mjs';
import { getPlatformRelease } from '../packages/platform-core/src/index.mjs';

const CHANNEL_IDS = ['dev', 'alpha', 'beta', 'rc1', 'stable', 'lts', 'enterprise', 'hotfix'];

test('channel catalog declares all v2.0 release tracks', () => {
  const catalog = loadChannelCatalog();
  assert.equal(catalog.baseVersion, '2.0.0');
  assert.equal(catalog.defaultChannel, 'dev');
  const ids = listChannels().map((ch) => ch.id);
  for (const id of CHANNEL_IDS) assert.ok(ids.includes(id), `missing ${id}`);
  const tags = describeChannels().map((ch) => ch.tag);
  assert.deepEqual(
    new Set(tags),
    new Set([
      'v2.0-alpha',
      'v2.0-beta',
      'v2.0-rc1',
      'v2.0-stable',
      'v2.0-lts',
      'v2.0-enterprise',
      'v2.0-dev',
      'v2.0-hotfix'
    ])
  );
});

test('parseReleaseToken accepts id, tag, and versioned forms', () => {
  for (const input of ['beta', 'v2.0-beta', '2.0-beta', '2.0.0-beta', 'V2.0-BETA']) {
    const parsed = parseReleaseToken(input);
    assert.equal(parsed.ok, true, `failed for ${input}`);
    assert.equal(parsed.channel.id, 'beta');
    assert.equal(parsed.tag, 'v2.0-beta');
  }
  const bad = parseReleaseToken('nightly');
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'unknown_channel');
});

test('formatReleaseTag and production eligibility matrix', () => {
  assert.equal(formatReleaseTag('alpha'), 'v2.0-alpha');
  assert.equal(formatReleaseTag('rc1'), 'v2.0-rc1');
  assert.equal(formatReleaseTag('enterprise'), 'v2.0-enterprise');
  assert.equal(isProductionEligible('alpha'), false);
  assert.equal(isProductionEligible('beta'), false);
  assert.equal(isProductionEligible('rc1'), false);
  assert.equal(isProductionEligible('dev'), false);
  assert.equal(isProductionEligible('stable'), true);
  assert.equal(isProductionEligible('lts'), true);
  assert.equal(isProductionEligible('enterprise'), true);
  assert.equal(isProductionEligible('hotfix'), true);
});

test('resolvePlatformReleaseSync defaults to v2.0-dev without stamp/env', () => {
  const prev = process.env.RTPSC_RELEASE_CHANNEL;
  delete process.env.RTPSC_RELEASE_CHANNEL;
  try {
    const release = resolvePlatformReleaseSync({ root: path.join(os.tmpdir(), 'rtpsc-no-stamp') });
    assert.equal(release.tag, 'v2.0-dev');
    assert.equal(release.version, '2.0.0');
    assert.equal(release.channel, 'dev');
    assert.equal(release.source, 'default');
    const block = releaseMetadataBlock(release);
    assert.equal(block.tag, 'v2.0-dev');
  } finally {
    if (prev === undefined) delete process.env.RTPSC_RELEASE_CHANNEL;
    else process.env.RTPSC_RELEASE_CHANNEL = prev;
  }
});

test('resolvePlatformReleaseSync reads stamped channel from root', async () => {
  const prev = process.env.RTPSC_RELEASE_CHANNEL;
  delete process.env.RTPSC_RELEASE_CHANNEL;
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rtpsc-sync-stamp-'));
  try {
    await stampPlatformRelease(tmp, { channel: 'stable', requestedBy: 'test' });
    const release = resolvePlatformReleaseSync({ root: tmp });
    assert.equal(release.tag, 'v2.0-stable');
    assert.equal(release.source, 'stamp');
    assert.match(release.buildId, /^[a-f0-9]{16}$/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
    if (prev === undefined) delete process.env.RTPSC_RELEASE_CHANNEL;
    else process.env.RTPSC_RELEASE_CHANNEL = prev;
  }
});

test('env RTPSC_RELEASE_CHANNEL overrides default channel', () => {
  const prev = process.env.RTPSC_RELEASE_CHANNEL;
  process.env.RTPSC_RELEASE_CHANNEL = 'enterprise';
  try {
    const release = resolvePlatformReleaseSync();
    assert.equal(release.tag, 'v2.0-enterprise');
    assert.equal(release.productionEligible, true);
    assert.equal(release.source, 'env');
  } finally {
    if (prev === undefined) delete process.env.RTPSC_RELEASE_CHANNEL;
    else process.env.RTPSC_RELEASE_CHANNEL = prev;
  }
});

test('stampPlatformRelease writes JSON + sha256 sidecar for every channel', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rtpsc-release-'));
  try {
    for (const channel of CHANNEL_IDS) {
      const result = await stampPlatformRelease(tmp, {
        channel,
        note: `test ${channel}`,
        requestedBy: 'test'
      });
      assert.equal(result.release.tag, `v2.0-${channel}`);
      assert.equal(result.release.version, '2.0.0');
      assert.match(result.release.buildId, /^[a-f0-9]{16}$/);
      const body = await readFile(path.join(tmp, 'build/platform-release.json'), 'utf8');
      const parsed = JSON.parse(body);
      assert.equal(parsed.channel, channel);
      assert.equal(parsed.channels.length, 8);
      const sha = await readFile(path.join(tmp, 'build/platform-release.sha256'), 'utf8');
      assert.match(sha, /^[a-f0-9]{64}  platform-release\.json\n$/);
      const resolved = await resolvePlatformRelease(tmp);
      assert.equal(resolved.tag, `v2.0-${channel}`);
      assert.equal(resolved.source, 'stamp');
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
