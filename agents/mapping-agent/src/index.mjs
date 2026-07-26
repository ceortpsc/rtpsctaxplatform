import { defineAgent } from '../../../packages/agent-core/src/index.mjs';
import { buildDependencyGraph, buildInsights } from '../../../packages/module-advisor/src/index.mjs';

export const mappingAgent = defineAgent({
  name: 'mapping-agent',
  title: 'Mapping & Enhancement Agent',
  description: 'Maps module relationships into a dependency graph and proposes enhancements.',
  capabilities: ['dependency-map', 'relationships', 'enhancements'],
  run: (context) => {
    const graph = buildDependencyGraph(context.catalog);
    const insights = buildInsights(context.catalog);

    return {
      summary: `Mapped ${graph.nodes.length} nodes and ${graph.edges.length} edges; ${insights.recommendations.length} enhancements proposed.`,
      sections: [
        {
          heading: 'Dependency edges',
          table: { columns: ['From', 'Type', 'To'], rows: graph.edges.map((e) => [e.from, e.type, e.to]) }
        },
        {
          heading: 'Enhancement recommendations',
          bullets: insights.recommendations.map((r) => `[${r.severity}] ${r.module ? `${r.module}: ` : ''}${r.message}`)
        },
        {
          heading: 'Dependency leaders',
          table: {
            columns: ['Service', 'Dependencies'],
            rows: insights.dependencyLeaders.map((d) => [d.name, String(d.dependencies)])
          }
        }
      ],
      data: { graph, insights }
    };
  }
});
