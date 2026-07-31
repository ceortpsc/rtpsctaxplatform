import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_RELEASE_CHANNEL,
  RELEASE_CHANNELS,
  activeRelease,
  createReleaseManifest,
  evaluatePromotion,
  getReleaseChannel,
  releaseCatalogHash,
  resolveReleaseChannel,
  validateReleaseCatalog
} from '../packages/release-core/src/index.mjs';

const expectedTags = [
  'v2.0-dev',
  'v2.0-alpha',
  'v2.0-beta',
  'v2.0-rc1',
  'v2.0-stable',
  'v2.0-lts',
  'v2.0-enterprise',
  'v2.0-hotfix'
];

const expectedSemvers = [
  '2.0.0-dev.0',
  '2.0.0-alpha.0',
  '2.0.0-beta.0',
  '2.0.0-rc.1',
  '2.0.0',
  '2.0.0+rtpsc.lts',
  '2.0.0+rtpsc.enterprise',
  '2.0.1-hotfix.0'
];

test('release catalog contains the eight canonical v2 public channels', () => {
  assert.equal(RELEASE_CHANNELS.length, 8);
  assert.deepEqual(RELEASE_CHANNELS.map((channel) => channel.tag), expectedTags);
  assert.deepEqual(RELEASE_CHANNELS.map((channel) => channel.semver), expectedSemvers);
  assert.equal(new Set(expectedTags).size, expectedTags.length);
  assert.equal(new Set(expectedSemvers).size, expectedSemvers.length);
  assert.deepEqual(validateReleaseCatalog(), { ok: true, errors: [], channelCount: 8 });
});

test('active platform channel is the honest developer build', () => {
  assert.equal(ACTIVE_RELEASE_CHANNEL, 'dev');
  assert.equal(activeRelease().tag, 'v2.0-dev');
  assert.equal(activeRelease().productionEligible, false);
  assert.equal(resolveReleaseChannel('v2.0-dev'), 'dev');
  assert.equal(resolveReleaseChannel('2.0.0-dev.0'), 'dev');
  assert.equal(getReleaseChannel('stable').tag, 'v2.0-stable');
});

test('promotion policy enforces path and target evidence gates', () => {
  const blockedEvidence = evaluatePromotion({ from: 'rc1', to: 'stable', evidence: ['lint', 'test', 'build'] });
  assert.equal(blockedEvidence.transitionAllowed, true);
  assert.equal(blockedEvidence.ok, false);
  assert.equal(blockedEvidence.decision, 'BLOCKED_MISSING_RELEASE_EVIDENCE');
  assert.ok(blockedEvidence.missingGates.includes('human-approval'));
  assert.ok(blockedEvidence.missingGates.includes('artifact-signing'));

  const stable = getReleaseChannel('stable');
  const ready = evaluatePromotion({ from: 'rc1', to: 'stable', evidence: stable.requiredGates });
  assert.equal(ready.ok, true);
  assert.equal(ready.decision, 'READY_FOR_HUMAN_RELEASE_APPROVAL');

  const invalidPath = evaluatePromotion({ from: 'dev', to: 'stable', evidence: stable.requiredGates });
  assert.equal(invalidPath.ok, false);
  assert.equal(invalidPath.transitionAllowed, false);
  assert.equal(invalidPath.decision, 'BLOCKED_INVALID_PROMOTION_PATH');
});

test('release manifests are integrity hashed and make no deployment claim', () => {
  const manifest = createReleaseManifest({
    channel: 'enterprise',
    commitSha: 'abc123',
    buildNumber: 42,
    generatedAt: '2026-07-31T09:00:00.000Z',
    appEnv: 'staging'
  });
  assert.equal(manifest.release.publicTag, 'v2.0-enterprise');
  assert.equal(manifest.release.productionEligible, true);
  assert.equal(manifest.status, 'RELEASE_PROFILE_REQUIRES_HUMAN_APPROVAL');
  assert.equal(manifest.gates.complete, false);
  assert.equal(manifest.externalRuntimeDeploymentStatus, 'NOT_CLAIMED');
  assert.match(manifest.integrity.digest, /^[a-f0-9]{64}$/);
  assert.match(releaseCatalogHash(), /^[a-f0-9]{64}$/);
});
