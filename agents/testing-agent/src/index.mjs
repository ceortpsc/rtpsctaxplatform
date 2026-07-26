import { defineAgent } from '../../../packages/agent-core/src/index.mjs';

export const testingAgent = defineAgent({
  name: 'testing-agent',
  title: 'Testing, Validation & Verification Agent',
  description: 'Runs validations and verifications across the module catalog, workflows, and environment.',
  capabilities: ['validation', 'verification', 'invariants'],
  run: (context) => {
    const checks = [];
    const known = new Set(context.catalog.flatMap((group) => group.modules.map((m) => m.name)));
    const add = (type, target, passed, detail) => checks.push({ type, target, passed, detail });

    for (const group of context.catalog) {
      for (const module of group.modules) {
        add('validation', module.name, Boolean(module.name && module.summary), 'has name + summary');
        add('validation', module.name, Array.isArray(module.tags) && module.tags.length > 0, 'has tags');
      }
    }

    (context.catalog.find((group) => group.category === 'services')?.modules ?? []).forEach((module) => {
      add('validation', module.name, (module.tags ?? []).some((tag) => tag.startsWith('port:')), 'declares a port');
      (module.detail?.dependencies ?? []).forEach((dep) =>
        add('verification', `${module.name} → ${dep}`, known.has(dep), 'dependency resolves to a known module')
      );
    });

    context.workflows.forEach((workflow) => {
      add('validation', workflow.name, Boolean(workflow.trigger?.type), 'workflow has a trigger');
      add('validation', workflow.name, (workflow.steps?.length ?? 0) > 0, 'workflow has steps');
    });

    add('verification', 'environment-protection', typeof context.environment?.protected === 'boolean', 'environment protection evaluated');

    const passed = checks.filter((c) => c.passed).length;
    const failed = checks.length - passed;
    const failedRows = checks.filter((c) => !c.passed).map((c) => [c.type, c.target, c.detail]);

    return {
      summary: `${passed}/${checks.length} checks passed (${failed} failed).`,
      sections: [
        { heading: 'Result', bullets: [`Total checks: ${checks.length}`, `Passed: ${passed}`, `Failed: ${failed}`] },
        failed
          ? { heading: 'Failed checks', table: { columns: ['Type', 'Target', 'Detail'], rows: failedRows } }
          : { heading: 'Failed checks', body: 'None — all checks passed.' },
        {
          heading: 'Sample checks',
          table: {
            columns: ['Type', 'Target', 'Detail', 'Result'],
            rows: checks.slice(0, 12).map((c) => [c.type, c.target, c.detail, c.passed ? 'PASS' : 'FAIL'])
          }
        }
      ],
      data: { total: checks.length, passed, failed, checks }
    };
  }
});
