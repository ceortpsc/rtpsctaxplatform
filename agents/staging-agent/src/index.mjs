import { defineAgent } from '../../../packages/agent-core/src/index.mjs';

function names(context, category) {
  return (context.catalog.find((group) => group.category === category)?.modules ?? []).map((m) => m.name);
}

export const stagingAgent = defineAgent({
  name: 'staging-agent',
  title: 'Staging Agent',
  description: 'Produces a staged rollout/promotion pipeline with gates, ending at environment-protected go-live.',
  capabilities: ['staged-rollout', 'promotion', 'gates'],
  run: (context) => {
    const stages = [
      { name: 'Stage 0 — Build', components: ['pnpm install', 'pnpm run lint', 'pnpm test', 'pnpm run build'], gate: 'All quality gates green' },
      { name: 'Stage 1 — Shared runtime', components: names(context, 'packages'), gate: 'Package tests pass' },
      { name: 'Stage 2 — Processing', components: [...names(context, 'engines'), ...names(context, 'pipelines'), ...names(context, 'workflows')], gate: 'Workflows validated' },
      { name: 'Stage 3 — Workers', components: names(context, 'workers'), gate: 'Background runner healthy' },
      { name: 'Stage 4 — Services', components: names(context, 'services'), gate: 'All /health endpoints OK (deploy:all)' },
      { name: 'Stage 5 — Promotion', components: ['local', 'dev', 'stage', 'prod'], gate: 'Environment protection satisfied before prod e-file transmission' }
    ];

    return {
      summary: `A ${stages.length}-stage promotion pipeline; live transmission is gated (currently: ${context.environment.protected ? 'PROTECTED' : 'LIVE'}).`,
      sections: [
        { heading: 'Staging pipeline', table: { columns: ['Stage', 'Components', 'Gate'], rows: stages.map((s) => [s.name, String(s.components.length), s.gate]) } },
        ...stages.map((stage) => ({ heading: stage.name, bullets: [`Components: ${stage.components.join(', ')}`, `Gate: ${stage.gate}`] })),
        { heading: 'Deploy command', code: { text: 'pnpm run deploy:all   # health-checks every service + background worker', lang: 'bash' } }
      ],
      data: { stages }
    };
  }
});
