import { defineAgent } from '../../../packages/agent-core/src/index.mjs';

const COMPLEXITY_WEIGHTS = { packages: 1, services: 3, workers: 2, pipelines: 2, engines: 2, workflows: 3, agents: 2 };

export const scopingAgent = defineAgent({
  name: 'scoping-agent',
  title: 'Scoping Agent',
  description: 'Inventories the platform, estimates complexity, and defines scope boundaries.',
  capabilities: ['inventory', 'complexity-index', 'boundaries'],
  run: (context) => {
    const rows = context.catalog.map((group) => [
      group.category,
      group.modules.length,
      (COMPLEXITY_WEIGHTS[group.category] ?? 1) * group.modules.length
    ]);
    const totalComplexity = rows.reduce((sum, row) => sum + row[2], 0);
    const deps = context.catalog
      .find((group) => group.category === 'services')
      ?.modules.flatMap((m) => m.detail?.dependencies ?? []) ?? [];

    return {
      summary: `Scope: ${context.summary.totalModules} modules across ${context.summary.categories.length} categories (complexity index ${totalComplexity}).`,
      sections: [
        { heading: 'In-scope categories', table: { columns: ['Category', 'Modules', 'Complexity'], rows } },
        {
          heading: 'Boundaries',
          bullets: [
            'Compliant adapters and executable stubs only',
            'No unauthorized IRS access or scraping workflows',
            'Live e-file transmission is gated by environment protection'
          ]
        },
        { heading: 'Declared service dependencies', bullets: [...new Set(deps)].length ? [...new Set(deps)] : ['None declared'] },
        {
          heading: 'Out of scope (this baseline)',
          bullets: ['Persistent storage / queues', 'Real IRS integrations', 'Authenticated operator edges']
        }
      ],
      data: { totalComplexity, categories: rows, dependencies: [...new Set(deps)] }
    };
  }
});
