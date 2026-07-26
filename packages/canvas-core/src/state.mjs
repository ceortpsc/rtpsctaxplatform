import { PLATFORM_IDENTITY, evaluateEnvironmentProtection } from '../../platform-core/src/index.mjs';
import { DEVELOPMENT_TEAM, buildAgentContext } from '../../agent-core/src/index.mjs';
import { buildModuleCatalog, catalogSummary } from '../../../services/modules-dashboard/src/catalog.mjs';

/** Build a serializable snapshot for a canvas kind. */
export function buildCanvasState(kindId, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const catalog = options.catalog ?? buildModuleCatalog();
  const summary = options.summary ?? catalogSummary(catalog);
  const environment = options.environment ?? evaluateEnvironmentProtection();
  const team = options.team ?? DEVELOPMENT_TEAM;
  const workflows = options.workflows ?? buildAgentContext().workflows;

  const categories = catalog.map((group) => ({
    category: group.category,
    description: group.description,
    count: group.modules.length,
    modules: group.modules.map((module) => ({
      name: module.name,
      summary: module.summary,
      tags: [...(module.tags ?? [])],
      dependsOn: extractDepends(module)
    }))
  }));

  const envView = {
    appEnv: environment.appEnv,
    protected: Boolean(environment.protected),
    transmissionAllowed: Boolean(environment.transmissionAllowed),
    safeguards: { ...(environment.safeguards ?? {}) },
    reasons: [...(environment.reasons ?? [])].slice(0, 16)
  };

  const base = {
    kind: kindId,
    title: titleFor(kindId),
    company: PLATFORM_IDENTITY.company,
    application: PLATFORM_IDENTITY.application,
    abbreviation: PLATFORM_IDENTITY.abbreviation,
    generatedAt
  };

  switch (kindId) {
    case 'platform':
      return {
        ...base,
        totalModules: summary.totalModules,
        categoryCounts: summary.categories,
        environment: envView,
        workflowCount: workflows.length,
        workflows: workflows.slice(0, 24).map((wf) => ({
          name: wf.name,
          trigger: wf.trigger?.type ?? 'manual',
          description: wf.description ?? ''
        }))
      };
    case 'compliance':
      return {
        ...base,
        environment: envView,
        gates: [
          {
            id: 'env-protection',
            label: 'Environment protection',
            status: environment.transmissionAllowed ? 'clear' : 'blocked',
            detail: environment.transmissionAllowed
              ? 'Protection evaluation reports clear for the current configuration.'
              : 'Transmission stays blocked until production safeguards pass.'
          },
          {
            id: 'secrets',
            label: 'Secrets posture',
            status: environment.safeguards?.secretsConfigured ? 'configured' : 'scaffold',
            detail: 'Client IDs/secrets and tunnel credentials remain environment-based only.'
          },
          {
            id: 'compliance-report',
            label: 'Production compliance report',
            status: 'ready_scaffold',
            detail: 'Expect overall ready_scaffold until manual legal/security/ops sign-offs.'
          },
          {
            id: 'ai-boundaries',
            label: 'AI persona boundaries',
            status: 'enforced',
            detail: 'AI cannot sign, transmit, or clear material HOLD (RTP-AI-001).'
          }
        ]
      };
    case 'agents':
      return {
        ...base,
        teamCount: team.length,
        team: team.map((member) => ({
          role: member.role,
          title: member.title,
          focus: member.focus
        })),
        note: 'Agents are deployment-assist & development tooling — not a runtime product subsystem.'
      };
    case 'modules':
      return {
        ...base,
        totalModules: summary.totalModules,
        categories
      };
    default:
      throw new Error(`Unknown canvas kind: ${kindId}`);
  }
}

function titleFor(kindId) {
  switch (kindId) {
    case 'platform':
      return 'RTPSC Platform Constellation';
    case 'compliance':
      return 'RTPSC Compliance Posture';
    case 'agents':
      return 'RTPSC Development Team';
    case 'modules':
      return 'RTPSC Module Catalog';
    default:
      return 'RTPSC Canvas';
  }
}

function extractDepends(module) {
  const detail = module.detail ?? {};
  const fromDetail = detail.dependsOn ?? detail.depends ?? detail.integrates ?? [];
  if (Array.isArray(fromDetail)) return fromDetail.map(String);
  return [];
}
