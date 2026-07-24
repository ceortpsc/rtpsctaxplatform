import { defineAgent } from '../../../packages/agent-core/src/index.mjs';

function names(context, category) {
  return (context.catalog.find((group) => group.category === category)?.modules ?? []).map((m) => m.name);
}

export const planningAgent = defineAgent({
  name: 'planning-agent',
  title: 'Planning Agent',
  description: 'Produces a phased delivery plan, milestones, and exit criteria from the module catalog.',
  capabilities: ['phase-planning', 'milestones', 'exit-criteria'],
  run: (context) => {
    const phases = [
      {
        name: 'Phase 1 — Foundation',
        objective: 'Harden shared runtime, configuration, and environment protection.',
        modules: names(context, 'packages'),
        exit: ['All package tests pass', 'Runtime config + environment protection reviewed']
      },
      {
        name: 'Phase 2 — Domain services',
        objective: 'Stand up HTTP service surfaces with health + metadata.',
        modules: names(context, 'services'),
        exit: ['Every service exposes /health and /metadata', 'Ports allocated without conflict']
      },
      {
        name: 'Phase 3 — Processing',
        objective: 'Wire pipelines, engines, and workflows into runnable flows.',
        modules: [...names(context, 'engines'), ...names(context, 'pipelines'), ...names(context, 'workflows')],
        exit: ['Workflows execute end-to-end in the background', 'Pipeline/engine descriptors validated']
      },
      {
        name: 'Phase 4 — Orchestration',
        objective: 'Background workers, deployment-assist team, and one-command deployment.',
        modules: [...names(context, 'workers'), ...(context.team ?? []).map((member) => member.role)],
        exit: ['deploy:all brings up the full platform', 'workflow-runner stable under cadence']
      },
      {
        name: 'Phase 5 — Hardening & go-live',
        objective: 'Compliance sign-off, secrets, and e-file transmission gating.',
        modules: ['secure-tunnel', 'environment-protection'],
        exit: ['Environment protection satisfied in production', 'Approved secure tunnel implemented after sign-off']
      }
    ];
    const milestones = phases.map((phase, index) => `M${index + 1}: ${phase.name.split('—')[1].trim()} complete`);

    return {
      summary: `A ${phases.length}-phase delivery plan spanning ${context.summary.totalModules} modules.`,
      sections: [
        {
          heading: 'Delivery phases',
          table: { columns: ['Phase', 'Objective', 'Modules'], rows: phases.map((p) => [p.name, p.objective, String(p.modules.length)]) }
        },
        ...phases.map((phase) => ({
          heading: phase.name,
          body: phase.objective,
          bullets: [`Modules: ${phase.modules.join(', ') || '—'}`, `Exit criteria: ${phase.exit.join('; ')}`]
        })),
        { heading: 'Milestones', ordered: milestones }
      ],
      data: { phases, milestones }
    };
  }
});
