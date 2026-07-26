import { defineAgent } from '../../../packages/agent-core/src/index.mjs';

function names(context, category) {
  return (context.catalog.find((group) => group.category === category)?.modules ?? []).map((m) => m.name);
}

export const assessmentAgent = defineAgent({
  name: 'assessment-agent',
  title: 'Environmental Assessment & Inspection Agent',
  description: 'Inspects the runtime environment, safeguards, and configuration, and reports findings.',
  capabilities: ['environment-inspection', 'safeguard-audit', 'findings'],
  run: (context) => {
    const env = context.environment;
    const services = names(context, 'services');
    const findings = env.reasons.map((reason) => ({ severity: 'info', message: reason }));
    if (env.transmissionAllowed) {
      findings.push({ severity: 'warning', message: 'Live e-file transmission is ENABLED in this environment.' });
    }
    if (findings.length === 0) findings.push({ severity: 'info', message: 'No blocking findings.' });

    return {
      summary: `Environment "${env.environment}" — ${env.protected ? 'PROTECTED (transmission blocked)' : 'LIVE transmission permitted'}.`,
      sections: [
        {
          heading: 'Environment',
          bullets: [
            `Application: ${context.identity.company} — ${context.identity.application}`,
            `Environment: ${env.environment}`,
            `Transmission allowed: ${env.transmissionAllowed}`,
            `Protected: ${env.protected}`
          ]
        },
        {
          heading: 'Safeguards',
          table: { columns: ['Safeguard', 'Status'], rows: Object.entries(env.safeguards).map(([key, value]) => [key, value ? 'PASS' : 'FAIL']) }
        },
        {
          heading: 'Inspection',
          bullets: [
            `Services expected: ${services.join(', ')}`,
            'Node engine: >=22',
            'Docker (Postgres/Redis): optional, unused by code',
            'Runtime dependencies: none (Node built-ins only)'
          ]
        },
        { heading: 'Findings', bullets: findings.map((f) => `[${f.severity}] ${f.message}`) }
      ],
      data: { environment: env, findings }
    };
  }
});
