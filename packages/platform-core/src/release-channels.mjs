/**
 * Ross Tax Pro Software Co 02.0V — release channel catalog and build logic.
 *
 * Channels:
 *   v2.0-alpha      early unstable build
 *   v2.0-beta       feature-complete but not final
 *   v2.0-rc1        release candidate
 *   v2.0-stable     final production build
 *   v2.0-lts        long-term support
 *   v2.0-enterprise enterprise-grade build
 *   v2.0-dev        developer build
 *   v2.0-hotfix     emergency patch
 */

export const RELEASE_LINE = Object.freeze({
  major: 2,
  minor: 0,
  brandVersion: '02.0V',
  semverBase: '2.0.0',
  product: 'Ross Tax Pro Software Co 02.0V'
});

export const RELEASE_CHANNELS = Object.freeze({
  alpha: Object.freeze({
    id: 'alpha',
    tag: 'v2.0-alpha',
    label: 'Alpha',
    description: 'Early unstable build',
    stability: 'unstable',
    maturity: 1,
    productionReady: false,
    supportWindow: 'short',
    defaultAppEnv: 'local',
    semver: '2.0.0-alpha',
    promotesTo: 'beta'
  }),
  beta: Object.freeze({
    id: 'beta',
    tag: 'v2.0-beta',
    label: 'Beta',
    description: 'Feature-complete but not final',
    stability: 'feature-complete',
    maturity: 2,
    productionReady: false,
    supportWindow: 'short',
    defaultAppEnv: 'stage',
    semver: '2.0.0-beta',
    promotesTo: 'rc1'
  }),
  rc1: Object.freeze({
    id: 'rc1',
    tag: 'v2.0-rc1',
    label: 'Release Candidate 1',
    description: 'Release candidate',
    stability: 'candidate',
    maturity: 3,
    productionReady: false,
    supportWindow: 'short',
    defaultAppEnv: 'stage',
    semver: '2.0.0-rc.1',
    promotesTo: 'stable'
  }),
  stable: Object.freeze({
    id: 'stable',
    tag: 'v2.0-stable',
    label: 'Stable',
    description: 'Final production build',
    stability: 'stable',
    maturity: 4,
    productionReady: true,
    supportWindow: 'standard',
    defaultAppEnv: 'production',
    semver: '2.0.0',
    promotesTo: 'lts'
  }),
  lts: Object.freeze({
    id: 'lts',
    tag: 'v2.0-lts',
    label: 'Long-Term Support',
    description: 'Long-term support',
    stability: 'lts',
    maturity: 5,
    productionReady: true,
    supportWindow: 'extended',
    defaultAppEnv: 'production',
    semver: '2.0.0+lts',
    promotesTo: null
  }),
  enterprise: Object.freeze({
    id: 'enterprise',
    tag: 'v2.0-enterprise',
    label: 'Enterprise',
    description: 'Enterprise-grade build',
    stability: 'enterprise',
    maturity: 5,
    productionReady: true,
    supportWindow: 'enterprise',
    defaultAppEnv: 'production',
    semver: '2.0.0+enterprise',
    promotesTo: null
  }),
  dev: Object.freeze({
    id: 'dev',
    tag: 'v2.0-dev',
    label: 'Developer',
    description: 'Developer build',
    stability: 'development',
    maturity: 0,
    productionReady: false,
    supportWindow: 'none',
    defaultAppEnv: 'local',
    semver: '2.0.0-dev',
    promotesTo: 'alpha'
  }),
  hotfix: Object.freeze({
    id: 'hotfix',
    tag: 'v2.0-hotfix',
    label: 'Hotfix',
    description: 'Emergency patch',
    stability: 'hotfix',
    maturity: 4,
    productionReady: true,
    supportWindow: 'urgent',
    defaultAppEnv: 'production',
    semver: '2.0.0+hotfix',
    promotesTo: 'stable'
  })
});

export const DEFAULT_RELEASE_CHANNEL = 'enterprise';

const ALIASES = Object.freeze({
  'v2.0-alpha': 'alpha',
  'v2.0-beta': 'beta',
  'v2.0-rc1': 'rc1',
  'v2.0-rc': 'rc1',
  'v2.0-stable': 'stable',
  'v2.0-lts': 'lts',
  'v2.0-enterprise': 'enterprise',
  'v2.0-dev': 'dev',
  'v2.0-hotfix': 'hotfix',
  '02.0v-alpha': 'alpha',
  '02.0v-beta': 'beta',
  '02.0v-rc1': 'rc1',
  '02.0v-stable': 'stable',
  '02.0v-lts': 'lts',
  '02.0v-enterprise': 'enterprise',
  '02.0v-dev': 'dev',
  '02.0v-hotfix': 'hotfix'
});

export function listReleaseChannels() {
  return Object.values(RELEASE_CHANNELS).sort((a, b) => a.maturity - b.maturity || a.id.localeCompare(b.id));
}

export function normalizeChannelId(input) {
  if (input == null || String(input).trim() === '') return null;
  const raw = String(input).trim().toLowerCase();
  if (RELEASE_CHANNELS[raw]) return raw;
  if (ALIASES[raw]) return ALIASES[raw];
  const stripped = raw.replace(/^v?2\.0[-_]?/, '').replace(/^02\.0v[-_]?/, '');
  if (RELEASE_CHANNELS[stripped]) return stripped;
  return null;
}

export function resolveReleaseChannel(input, { fallback = DEFAULT_RELEASE_CHANNEL } = {}) {
  const id = normalizeChannelId(input) ?? normalizeChannelId(fallback) ?? DEFAULT_RELEASE_CHANNEL;
  const channel = RELEASE_CHANNELS[id];
  if (!channel) {
    const err = new Error(`Unknown release channel: ${input}`);
    err.code = 'unknown_release_channel';
    throw err;
  }
  return channel;
}

export function resolveChannelFromEnv(env = process.env, overrides = {}) {
  const raw =
    overrides.releaseChannel ??
    env.RTP_RELEASE_CHANNEL ??
    env.RTPSC_RELEASE_CHANNEL ??
    env.RELEASE_CHANNEL ??
    DEFAULT_RELEASE_CHANNEL;
  return resolveReleaseChannel(raw);
}

export function describeReleaseChannel(input) {
  const channel = resolveReleaseChannel(input);
  return {
    line: RELEASE_LINE,
    channel,
    display: `${RELEASE_LINE.product} · ${channel.tag}`,
    gate: {
      productionReady: channel.productionReady,
      allowsLiveTransmissionGate: channel.productionReady,
      recommendedAppEnv: channel.defaultAppEnv
    }
  };
}

export function buildReleaseManifest(input, extras = {}) {
  const described = describeReleaseChannel(input);
  const builtAt = extras.builtAt || new Date().toISOString();
  const buildId =
    extras.buildId ||
    `rtpsc-${described.channel.id}-${builtAt.replace(/[-:TZ.]/g, '').slice(0, 14)}`;

  return Object.freeze({
    schema: 'rtpsc-release-manifest/v1',
    product: RELEASE_LINE.product,
    brandVersion: RELEASE_LINE.brandVersion,
    line: RELEASE_LINE,
    channel: described.channel,
    display: described.display,
    gate: described.gate,
    buildId,
    builtAt,
    artifacts: Object.freeze({
      platformManifest: 'build/platform-manifest.json',
      releaseManifest: `build/releases/${described.channel.tag}/manifest.json`,
      activeRelease: 'build/active-release.json'
    }),
    notes: extras.notes || described.channel.description,
    modules: extras.modules || null,
    compliance: Object.freeze([
      'No unauthorized access to IRS systems.',
      'Release channel selection does not bypass environment protection.',
      'Only productionReady channels may be activated for live APP_ENV=production cutover.'
    ])
  });
}

export function assertChannelActivatable(channel, { appEnv = 'local', force = false } = {}) {
  const productionLike = appEnv === 'prod' || appEnv === 'production';
  if (productionLike && !channel.productionReady && !force) {
    const err = new Error(
      `Channel ${channel.tag} is not production-ready and cannot activate under APP_ENV=${appEnv}`
    );
    err.code = 'channel_not_production_ready';
    throw err;
  }
  return true;
}

export function promotionPath(fromId) {
  const path = [];
  let current = resolveReleaseChannel(fromId);
  path.push(current.id);
  const seen = new Set([current.id]);
  while (current.promotesTo) {
    if (seen.has(current.promotesTo)) break;
    seen.add(current.promotesTo);
    current = RELEASE_CHANNELS[current.promotesTo];
    path.push(current.id);
  }
  return path;
}
