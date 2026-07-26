import { defineAgent, md, renderReportDocument } from '../../../packages/agent-core/src/index.mjs';

export const markdownAgent = defineAgent({
  name: 'markdown-agent',
  title: 'Markdown Generation Engine',
  description: 'Renders structured agent reports into a full set of markdown documentation.',
  capabilities: ['markdown-rendering', 'doc-generation', 'index'],
  run: (context) => {
    const reports = context.reports ?? [];
    const documents = [];

    const overview = [
      md.h1(`${context.identity.company} — Deployment Assist & Development Team`),
      md.p(`_${context.identity.application}_`),
      md.p(
        'This is a virtual **deployment-assist and development team** — developer/deployment tooling ' +
          '(not a runtime subsystem of the product). Each team member is an agent that analyzes the ' +
          'codebase and produces a report. Run with `pnpm run agents`; regenerate these docs with `pnpm run agents:docs`.'
      ),
      md.h2('Team & reports'),
      md.table(
        ['Team member', 'Report', 'Summary'],
        reports.map((r) => [r.title, `[${r.agent}](./${r.agent}.md)`, r.summary || r.status])
      ),
      md.h2('Platform context'),
      md.bullets([
        `Modules: ${context.summary.totalModules}`,
        `Categories: ${context.summary.categories.length}`,
        `Workflows: ${context.workflows.length}`,
        `Environment: ${context.environment.environment} (${context.environment.protected ? 'protected' : 'live'})`
      ])
    ].join('\n');
    documents.push({ path: 'docs/agents/README.md', title: 'Agent Reports', markdown: overview });

    for (const report of reports) {
      documents.push({ path: `docs/agents/${report.agent}.md`, title: report.title, markdown: renderReportDocument(report) });
    }

    return {
      summary: `Generated ${documents.length} markdown document(s).`,
      sections: [{ heading: 'Generated documents', bullets: documents.map((d) => `\`${d.path}\``) }],
      data: { documents }
    };
  }
});
