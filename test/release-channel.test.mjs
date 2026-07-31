import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  canPromote,
  createReleaseManifest,
  loadReleaseConfig,
  resolveChannel,
  validateReleaseConfig
} from '../scripts/release-channel.mjs';

const configPath = new URL('../config/release-channels.json', import.meta.url);
const config = loadReleaseConfig(configPath);

test('registry defines every required v2.0 channel', () => {
  assert.deepEqual(
    config.channels.map(({ id }) => id).sort(),
    ['alpha', 'beta', 'dev', 'enterprise', 'hotfix', 'lts', 'rc1', 'stable'].sort()
  );
});

test('all tags and semantic versions are unique', () => {
  assert.equal(new Set(config.channels.map(({ tag }) => tag)).size, config.channels.length);
  assert.equal(new Set(config.channels.map(({ semanticVersion }) => semanticVersion)).size, config.channels.length);
});

test('stable resolves to the production semantic version', () => {
  const stable = resolveChannel(config, 'v2.0-stable');
  assert.equal(stable.id, 'stable');
  assert.equal(stable.semanticVersion, '2.0.0');
  assert.equal(stable.prerelease, false);
  assert.equal(stable.deploymentEnvironment, 'production');
});

test('promotion rules are explicit and fail closed', () => {
  assert.equal(canPromote(config, 'alpha', 'beta'), true);
  assert.equal(canPromote(config, 'beta', 'stable'), false);
  assert.equal(canPromote(config, 'rc1', 'stable'), true);
});

test('manifest output is deterministic when inputs are supplied', () => {
  const manifest = createReleaseManifest(config, 'enterprise', {
    commitSha: '0123456789abcdef',
    sourceBranch: 'enterprise/v2.0',
    repository: 'ceortpsc/rtpsctaxplatform',
    createdAt: '2026-07-31T09:43:00.000Z'
  });
  assert.equal(manifest.tag, 'v2.0-enterprise');
  assert.equal(manifest.semanticVersion, '2.0.0-enterprise.0');
  assert.equal(manifest.commitSha, '0123456789abcdef');
  assert.equal(manifest.generatedAt, '2026-07-31T09:43:00.000Z');
});

test('invalid duplicate channels are rejected', () => {
  const invalid = structuredClone(config);
  invalid.channels.push(structuredClone(invalid.channels[0]));
  assert.throws(() => validateReleaseConfig(invalid), /duplicates/);
});

test('configuration loader rejects malformed JSON', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rtpsc-release-'));
  const invalidPath = path.join(directory, 'invalid.json');
  fs.writeFileSync(invalidPath, '{not-json', 'utf8');
  assert.throws(() => loadReleaseConfig(invalidPath), /Unable to load/);
});
