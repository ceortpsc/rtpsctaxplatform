import crypto from 'node:crypto';

export const RELEASE_PRODUCT = 'Ross Tax Pro Software Co Platform';
export const RELEASE_BASE_VERSION = '2.0';
export const ACTIVE_RELEASE_CHANNEL = 'dev';

const COMMON_GATES = Object.freeze(['lint', 'test', 'build']);

const definitions = [
  {
    key: 'dev',
    tag: 'v2.0-dev',
    semver: '2.0.0-dev.0',
    stage: 'development',
    description: 'Developer build',
    stability: 'unstable',
    productionEligible: false,
    supportPolicy: 'Development use only; no compatibility or uptime commitment.',
    requiredGates: [...COMMON_GATES],
    allowedPromotionTargets: ['alpha']
  },
  {
    key: 'alpha',
    tag: 'v2.0-alpha',
    semver: '2.0.0-alpha.0',
    stage: 'early-preview',
    description: 'Early unstable build',
    stability: 'experimental',
    productionEligible: false,
    supportPolicy: 'Internal preview; breaking changes are expected.',
    requiredGates: [...COMMON_GATES, 'qa-smoke'],
    allowedPromotionTargets: ['beta']
  },
  {
    key: 'beta',
    tag: 'v2.0-beta',
    semver: '2.0.0-beta.0',
    stage: 'feature-complete-preview',
    description: 'Feature-complete but not final',
    stability: 'preview',
    productionEligible: false,
    supportPolicy: 'Feature-complete evaluation build; defects may remain.',
    requiredGates: [...COMMON_GATES, 'qa-smoke', 'feature-freeze'],
    allowedPromotionTargets: ['rc1']
  },
  {
    key: 'rc1',
    tag: 'v2.0-rc1',
    semver: '2.0.0-rc.1',
    stage: 'release-candidate',
    description: 'Release candidate',
    stability: 'candidate',
    productionEligible: false,
    supportPolicy: 'Staging and acceptance testing only until final approval.',
    requiredGates: [
      ...COMMON_GATES,
      'qa-regression',
      'security-review',
      'compliance-review',
      'release-notes'
    ],
    allowedPromotionTargets: ['stable']
  },
  {
    key: 'stable',
    tag: 'v2.0-stable',
    semver: '2.0.0',
    stage: 'general-availability',
    description: 'Final production build',
    stability: 'stable',
    productionEligible: true,
    supportPolicy: 'General availability maintenance and supported production operation.',
    requiredGates: [
      ...COMMON_GATES,
      'qa-regression',
      'security-review',
      'compliance-review',
      'human-approval',
      'rollback-plan',
      'artifact-signing'
    ],
    allowedPromotionTargets: ['lts', 'enterprise', 'hotfix']
  },
  {
    key: 'lts',
    tag: 'v2.0-lts',
    semver: '2.0.0+rtpsc.lts',
    stage: 'long-term-support',
    description: 'Long-term support',
    stability: 'stable-lts',
    productionEligible: true,
    supportPolicy: 'Long-term security, defect-fix, and controlled backport support line.',
    requiredGates: [
      ...COMMON_GATES,
      'qa-regression',
      'security-review',
      'compliance-review',
      'human-approval',
      'rollback-plan',
      'artifact-signing',
      'support-policy',
      'backport-plan'
    ],
    allowedPromotionTargets: ['hotfix']
  },
  {
    key: 'enterprise',
    tag: 'v2.0-enterprise',
    semver: '2.0.0+rtpsc.enterprise',
    stage: 'enterprise',
    description: 'Enterprise-grade build',
    stability: 'stable-enterprise',
    productionEligible: true,
    supportPolicy: 'Enterprise deployment profile with governance and operational evidence requirements.',
    requiredGates: [
      ...COMMON_GATES,
      'qa-regression',
      'security-review',
      'compliance-review',
      'human-approval',
      'rollback-plan',
      'artifact-signing',
      'tenant-isolation-review',
      'rbac-review',
      'audit-evidence',
      'sla-readiness'
    ],
    allowedPromotionTargets: ['hotfix']
  },
  {
    key: 'hotfix',
    tag: 'v2.0-hotfix',
    semver: '2.0.1-hotfix.0',
    stage: 'emergency-patch',
    description: 'Emergency patch',
    stability: 'controlled-emergency',
    productionEligible: true,
    supportPolicy: 'Expedited patch profile with targeted validation and mandatory rollback evidence.',
    requiredGates: [
      'lint',
      'targeted-tests',
      'build',
      'security-review',
      'human-approval',
      'rollback-plan',
      'incident-record'
    ],
    allowedPromotionTargets: ['stable', 'lts', 'enterprise']
  }
];

export const RELEASE_CHANNELS = Object.freeze(
  definitions.map((definition) =>
    Object.freeze({
      ...definition,
      requiredGates: Object.freeze([...definition.requiredGates]),
      allowedPromotionTargets: Object.freeze([...definition.allowedPromotionTargets])
    })
  )
);

const byKey = new Map(RELEASE_CHANNELS.map((channel) => [channel.key, channel]));
const aliases = new Map();
for (const channel of RELEASE_CHANNELS) {
  aliases.set(channel.key, channel.key);
  aliases.set(channel.tag.toLowerCase(), channel.key);
  aliases.set(channel.tag.replace(/^v/, '').toLowerCase(), channel.key);
  aliases.set(channel.semver.toLowerCase(), channel.key);
}

function normalizeEvidence(evidence) {
  if (Array.isArray(evidence)) return new Set(evidence.map((item) => String(item).trim()).filter(Boolean));
  if (evidence && typeof evidence === 'object') {
    return new Set(
      Object.entries(evidence)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
    );
  }
  return new Set();
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function resolveReleaseChannel(input = ACTIVE_RELEASE_CHANNEL) {
  const normalized = String(input ?? ACTIVE_RELEASE_CHANNEL).trim().toLowerCase();
  return aliases.get(normalized) ?? null;
}

export function getReleaseChannel(input = ACTIVE_RELEASE_CHANNEL) {
  const key = resolveReleaseChannel(input);
  if (!key) {
    const error = new Error(`Unknown RTPSC release channel "${input}".`);
    error.code = 'unknown_release_channel';
    throw error;
  }
  return byKey.get(key);
}

export function listReleaseChannels() {
  return RELEASE_CHANNELS.map((channel) => ({ ...channel }));
}

export function validateReleaseCatalog() {
  const errors = [];
  const tags = new Set();
  const semvers = new Set();
  const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

  for (const channel of RELEASE_CHANNELS) {
    if (!channel.tag.startsWith(`v${RELEASE_BASE_VERSION}-`)) {
      errors.push(`${channel.key}: tag must start with v${RELEASE_BASE_VERSION}-.`);
    }
    if (!semverPattern.test(channel.semver)) errors.push(`${channel.key}: invalid internal SemVer ${channel.semver}.`);
    if (tags.has(channel.tag)) errors.push(`${channel.key}: duplicate public tag ${channel.tag}.`);
    if (semvers.has(channel.semver)) errors.push(`${channel.key}: duplicate internal SemVer ${channel.semver}.`);
    tags.add(channel.tag);
    semvers.add(channel.semver);
    if (channel.requiredGates.length === 0) errors.push(`${channel.key}: at least one release gate is required.`);
    for (const target of channel.allowedPromotionTargets) {
      if (!byKey.has(target)) errors.push(`${channel.key}: unknown promotion target ${target}.`);
    }
  }

  if (!byKey.has(ACTIVE_RELEASE_CHANNEL)) errors.push('Active release channel is not in the catalog.');
  return Object.freeze({ ok: errors.length === 0, errors, channelCount: RELEASE_CHANNELS.length });
}

export function evaluatePromotion({ from, to, evidence = [] } = {}) {
  const source = getReleaseChannel(from);
  const target = getReleaseChannel(to);
  const transitionAllowed = source.allowedPromotionTargets.includes(target.key);
  const supplied = normalizeEvidence(evidence);
  const missingGates = target.requiredGates.filter((gate) => !supplied.has(gate));
  return Object.freeze({
    ok: transitionAllowed && missingGates.length === 0,
    transitionAllowed,
    from: source.tag,
    to: target.tag,
    productionEligible: target.productionEligible,
    requiredGates: [...target.requiredGates],
    satisfiedGates: target.requiredGates.filter((gate) => supplied.has(gate)),
    missingGates,
    decision:
      !transitionAllowed
        ? 'BLOCKED_INVALID_PROMOTION_PATH'
        : missingGates.length > 0
          ? 'BLOCKED_MISSING_RELEASE_EVIDENCE'
          : 'READY_FOR_HUMAN_RELEASE_APPROVAL'
  });
}

export function createReleaseManifest({
  channel = ACTIVE_RELEASE_CHANNEL,
  commitSha = 'unresolved',
  buildNumber = null,
  generatedAt = new Date().toISOString(),
  appEnv = 'local',
  evidence = []
} = {}) {
  const profile = getReleaseChannel(channel);
  const supplied = normalizeEvidence(evidence);
  const missingGates = profile.requiredGates.filter((gate) => !supplied.has(gate));
  const catalog = validateReleaseCatalog();
  const releaseStatus =
    profile.key === 'dev'
      ? 'DEVELOPMENT_BUILD'
      : profile.productionEligible
        ? 'RELEASE_PROFILE_REQUIRES_HUMAN_APPROVAL'
        : 'NON_PRODUCTION_PRERELEASE';

  const manifest = {
    schemaVersion: '2.0',
    product: RELEASE_PRODUCT,
    baseVersion: RELEASE_BASE_VERSION,
    release: {
      channel: profile.key,
      publicTag: profile.tag,
      semver: profile.semver,
      stage: profile.stage,
      description: profile.description,
      stability: profile.stability,
      productionEligible: profile.productionEligible,
      supportPolicy: profile.supportPolicy
    },
    source: {
      commitSha: String(commitSha || 'unresolved'),
      buildNumber: buildNumber === null || buildNumber === undefined ? null : String(buildNumber)
    },
    environment: String(appEnv || 'local'),
    gates: {
      required: [...profile.requiredGates],
      supplied: profile.requiredGates.filter((gate) => supplied.has(gate)),
      missing: missingGates,
      complete: missingGates.length === 0
    },
    status: releaseStatus,
    artifactStatus: catalog.ok ? 'MANIFEST_GENERATED' : 'BLOCKED_INVALID_RELEASE_CATALOG',
    externalRuntimeDeploymentStatus: 'NOT_CLAIMED',
    generatedAt
  };
  const sha256 = crypto.createHash('sha256').update(canonicalJson(manifest)).digest('hex');
  return Object.freeze({ ...manifest, integrity: { algorithm: 'sha256', digest: sha256 } });
}

export function activeRelease() {
  return getReleaseChannel(ACTIVE_RELEASE_CHANNEL);
}

export function releaseCatalogHash() {
  return crypto.createHash('sha256').update(canonicalJson(RELEASE_CHANNELS)).digest('hex');
}

export const __testing = Object.freeze({ canonicalJson, normalizeEvidence });
