/**
 * ROSS.CO ITR core product lifecycle.
 * Map → Plan → Scope → Stage → Test → Validate → Verify → Register → Presence → SEO
 */

export const LIFECYCLE_STAGES = Object.freeze([
  {
    id: 'map',
    title: 'Engineering Mapping',
    description: 'Inventory workspaces, dependencies, and transfer graph.',
    gates: ['workspace-discovery', 'lockfile-present']
  },
  {
    id: 'plan',
    title: 'Planning',
    description: 'Define release goals, transfer-rate targets, and risk budget.',
    gates: ['release-goals', 'velocity-target']
  },
  {
    id: 'scope',
    title: 'Scoping',
    description: 'Bound in-scope modules vs deferred work for this stage.',
    gates: ['module-boundary', 'out-of-scope-list']
  },
  {
    id: 'stage',
    title: 'Staging',
    description: 'Prepare staging constellation and freeze candidates.',
    gates: ['stage-lock', 'artifact-bundle']
  },
  {
    id: 'test',
    title: 'Testing',
    description: 'Execute unit, integration, and transfer-rate benches.',
    gates: ['unit-pass', 'bench-baseline']
  },
  {
    id: 'validate',
    title: 'Validating',
    description: 'Confirm config schemas, lock integrity, and compliance notices.',
    gates: ['schema-valid', 'lock-integrity']
  },
  {
    id: 'verify',
    title: 'Verifying',
    description: 'Reproduce install + run signals on a clean path.',
    gates: ['repro-install', 'health-smoke']
  },
  {
    id: 'register',
    title: 'Registering',
    description: 'Seal copyright, version, and internal product registry entry.',
    gates: ['copyright-seal', 'registry-entry']
  },
  {
    id: 'presence',
    title: 'Online Presence',
    description: 'Publish brand surface, MOTD, and presence landing assets.',
    gates: ['landing-present', 'brand-assets']
  },
  {
    id: 'seo',
    title: 'SEO & Discovery',
    description: 'Emit sitemap, robots, and structured metadata for ross.co.',
    gates: ['sitemap', 'structured-data']
  }
]);

export function lifecycleMap() {
  return {
    product: 'ROSS.CO Infinite Transfer Rate',
    stages: LIFECYCLE_STAGES,
    edges: LIFECYCLE_STAGES.slice(0, -1).map((stage, index) => ({
      from: stage.id,
      to: LIFECYCLE_STAGES[index + 1].id
    }))
  };
}

export function planRelease({ targetMbps = Number.POSITIVE_INFINITY, modules = [] } = {}) {
  return {
    stage: 'plan',
    goals: [
      'Unbounded parallel workspace transfer (ITR mode)',
      'Deterministic lock seal via AOL/RTPSC lockfile',
      'Lifecycle gates green before register/presence'
    ],
    velocityTarget: {
      mode: 'infinite',
      symbolicMbps: targetMbps,
      note: 'Infinite mode means linker-bound parallel transfer with no artificial throttle.'
    },
    modules,
    risks: [
      'External registry fetch remains out of scope',
      'Live IRS transport is separate from package transfer rate'
    ]
  };
}

export function scopeRelease({ include = [], defer = [] } = {}) {
  return {
    stage: 'scope',
    inScope: include.length
      ? include
      : [
          'tools/rossco',
          'tools/aol',
          'engines/refund-optimization-engine',
          'engines/refund-intelligence-engine',
          'presence/rossco'
        ],
    deferred: defer.length
      ? defer
      : ['external npm registry protocol', 'paid CDN distribution', 'trademark office filing automation'],
    acceptance: [
      'CLI exposes full lifecycle commands',
      'Tests cover transfer, lifecycle, copyright, SEO emit',
      'Presence landing loads without external runtime deps'
    ]
  };
}
