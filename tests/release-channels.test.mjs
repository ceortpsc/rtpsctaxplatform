import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import {
  RELEASE_CHANNELS,
  RELEASE_LINE,
  listReleaseChannels,
  resolveReleaseChannel,
  normalizeChannelId,
  describeReleaseChannel,
  buildReleaseManifest,
  assertChannelActivatable,
  promotionPath,
  DEFAULT_RELEASE_CHANNEL
} from '../packages/platform-core/src/release-channels.mjs';
import { loadRuntimeConfig, evaluateEnvironmentProtection } from '../packages/platform-core/src/index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('all eight v2.0 release channels are defined', () => {
  const tags = listReleaseChannels().map((c) => c.tag).sort();
  assert.deepEqual(
    tags,
    [
      'v2.0-alpha',
      'v2.0-beta',
      'v2.0-dev',
      'v2.0-enterprise',
      'v2.0-hotfix',
      'v2.0-lts',
      'v2.0-rc1',
      'v2.0-stable'
    ].sort()
  );
  assert.equal(RELEASE_LINE.brandVersion, '02.0V');
  assert.equal(DEFAULT_RELEASE_CHANNEL, 'enterprise');
  assert.match(RELEASE_CHANNELS.alpha.description, /early unstable/i);
  assert.match(RELEASE_CHANNELS.beta.description, /feature-complete/i);
  assert.match(RELEASE_CHANNELS.rc1.description, /release candidate/i);
  assert.match(RELEASE_CHANNELS.stable.description, /final production/i);
  assert.match(RELEASE_CHANNELS.lts.description, /long-term support/i);
  assert.match(RELEASE_CHANNELS.enterprise.description, /enterprise-grade/i);
  assert.match(RELEASE_CHANNELS.dev.description, /developer/i);
  assert.match(RELEASE_CHANNELS.hotfix.description, /emergency patch/i);
});

test('channel aliases and promotion path resolve', () => {
  assert.equal(normalizeChannelId('v2.0-rc1'), 'rc1');
  assert.equal(resolveReleaseChannel('02.0V-enterprise').tag, 'v2.0-enterprise');
  assert.deepEqual(promotionPath('dev'), ['dev', 'alpha', 'beta', 'rc1', 'stable', 'lts']);
  assert.deepEqual(promotionPath('hotfix'), ['hotfix', 'stable', 'lts']);
});

test('manifest and production activation gates', () => {
  const manifest = buildReleaseManifest('enterprise');
  assert.equal(manifest.channel.tag, 'v2.0-enterprise');
  assert.equal(manifest.gate.productionReady, true);
  assert.equal(describeReleaseChannel('alpha').gate.productionReady, false);
  assert.throws(
    () => assertChannelActivatable(RELEASE_CHANNELS.alpha, { appEnv: 'production' }),
    (error) => error.code === 'channel_not_production_ready'
  );
  assert.equal(assertChannelActivatable(RELEASE_CHANNELS.stable, { appEnv: 'production' }), true);
});

test('runtime config and env protection expose release channel', () => {
  const previous = process.env.RTP_RELEASE_CHANNEL;
  process.env.RTP_RELEASE_CHANNEL = 'v2.0-lts';
  try {
    const config = loadRuntimeConfig({ appEnv: 'local' });
    assert.equal(config.releaseChannelTag, 'v2.0-lts');
    const protection = evaluateEnvironmentProtection(config);
    assert.equal(protection.releaseChannel.tag, 'v2.0-lts');
    assert.equal(protection.releaseChannel.productionReady, true);
  } finally {
    if (previous == null) delete process.env.RTP_RELEASE_CHANNEL;
    else process.env.RTP_RELEASE_CHANNEL = previous;
  }
});

test('release CLI builds every channel and activates enterprise', () => {
  // Match CI: no pre-existing platform manifest — release must not leak build logs onto stdout.
  try {
    unlinkSync(path.join(repoRoot, 'build', 'platform-manifest.json'));
  } catch {
    // absent is fine
  }

  const result = spawnSync(process.execPath, ['scripts/release.mjs', 'build', 'all'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.built, 8);

  const activate = spawnSync(process.execPath, ['scripts/release.mjs', 'activate', 'enterprise'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, APP_ENV: 'production' }
  });
  assert.equal(activate.status, 0, activate.stderr || activate.stdout);
  const active = JSON.parse(activate.stdout).active;
  assert.equal(active.channel.tag, 'v2.0-enterprise');
});
