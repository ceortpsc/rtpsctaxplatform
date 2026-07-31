import { access } from 'node:fs/promises';
import path from 'node:path';
import { defineAgent } from '../../../packages/agent-core/src/index.mjs';
import {
  loadOwnershipConfig,
  ownershipPlan,
  generateSeoAssets,
  prevalidateOwnership,
  EVIDENCE_STATES
} from '../../../tools/ross-infinite/src/index.mjs';

export const seoOwnershipAgent = defineAgent({
  name: 'seo-ownership-agent',
  title: 'SEO Ownership & Search Console Agent',
  description:
    'Asserts ROSS.CO ownership, generates SEO assets, prevalidates Search Console readiness, and records evidence separately from provider verification.',
  capabilities: ['seo-ownership', 'search-console-prevalidation', 'indexnow-planning', 'evidence-receipts'],
  run: async (context) => {
    const root = process.cwd();
    const configPath = 'config/seo/ross.co.ownership.json';
    let config;
    let plan;
    let generate = null;
    let prevalidate = null;
    const findings = [];

    try {
      await access(path.join(root, configPath));
      ({ config } = await loadOwnershipConfig(root, configPath));
      plan = ownershipPlan(config);
      generate = await generateSeoAssets(root, config, {
        env: {
          ...process.env,
          INDEXNOW_KEY: process.env.INDEXNOW_KEY || '0'.repeat(32)
        }
      });
      prevalidate = await prevalidateOwnership(root, config, {
        live: false,
        env: {
          ...process.env,
          INDEXNOW_KEY: process.env.INDEXNOW_KEY || '0'.repeat(32)
        }
      });
      if (!config.owner.ownerAssertion) findings.push({ severity: 'error', message: 'Owner assertion is false' });
      if (!prevalidate.ok) findings.push({ severity: 'warning', message: 'Local SEO prevalidation reported failures' });
      findings.push({
        severity: 'info',
        message: 'Provider verification remains pending until DNS/token assets are confirmed by Google or Bing.'
      });
    } catch (error) {
      findings.push({ severity: 'error', message: error.message });
    }

    const ownerName = config?.owner?.ownerName || 'unconfigured';
    return {
      summary: `SEO ownership ${config?.owner?.ownerAssertion ? 'asserted' : 'missing'} for ${ownerName}; state=${prevalidate?.state || 'UNKNOWN'}.`,
      sections: [
        {
          heading: 'Ownership',
          bullets: [
            `Legal name: ${config?.owner?.legalName || 'n/a'}`,
            `Owner: ${ownerName}`,
            `Asserted at: ${config?.owner?.assertedAt || 'n/a'}`,
            `Organization: ${config?.owner?.organization || 'n/a'}`
          ]
        },
        {
          heading: 'Properties',
          table: {
            columns: ['Host', 'Type', 'Role'],
            rows: (plan?.properties || []).map((p) => [p.host, p.propertyType, p.role || ''])
          }
        },
        {
          heading: 'Evidence pipeline',
          bullets: EVIDENCE_STATES.map((state, index) => `${index + 1}. ${state}`)
        },
        {
          heading: 'Local controls',
          bullets: [
            `Generate files: ${generate?.files?.length ?? 0}`,
            `Prevalidate ok: ${prevalidate?.ok ?? false}`,
            `Current state: ${prevalidate?.state || 'n/a'}`,
            'Google/Bing mutations remain dry-run unless --execute is used with credentials'
          ]
        },
        {
          heading: 'Findings',
          bullets: findings.map((f) => `[${f.severity}] ${f.message}`)
        },
        {
          heading: 'Platform context',
          bullets: [
            `Application: ${context.identity.company} — ${context.identity.application}`,
            `Environment: ${context.environment.environment}`,
            'CLI: ./scripts/ross-infinite seo …'
          ]
        }
      ],
      data: {
        owner: config?.owner || null,
        plan,
        generate,
        prevalidate,
        findings,
        evidenceStates: EVIDENCE_STATES
      }
    };
  }
});
