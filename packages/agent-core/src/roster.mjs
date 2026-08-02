// Roster: assembles the full RTPSC agent suite and orchestrates a full run.
import { buildAgentContext, createAgentRegistry, runAgent, runAgents } from './index.mjs';
import { planningAgent } from '../../../agents/planning-agent/src/index.mjs';
import { scopingAgent } from '../../../agents/scoping-agent/src/index.mjs';
import { testingAgent } from '../../../agents/testing-agent/src/index.mjs';
import { mappingAgent } from '../../../agents/mapping-agent/src/index.mjs';
import { stagingAgent } from '../../../agents/staging-agent/src/index.mjs';
import { assessmentAgent } from '../../../agents/assessment-agent/src/index.mjs';
import { seoOwnershipAgent } from '../../../agents/seo-ownership-agent/src/index.mjs';
import { markdownAgent } from '../../../agents/markdown-agent/src/index.mjs';

// Analysis agents run first; the markdown engine renders their reports last.
export const analysisAgents = [
  planningAgent,
  scopingAgent,
  testingAgent,
  mappingAgent,
  stagingAgent,
  assessmentAgent,
  seoOwnershipAgent
];
export const platformAgents = [...analysisAgents, markdownAgent];

export function createPlatformAgentRegistry() {
  return createAgentRegistry(platformAgents);
}

export async function runPlatformAgents() {
  const context = buildAgentContext();
  const reports = await runAgents(analysisAgents, context);
  const markdownReport = await runAgent(markdownAgent, { ...context, reports });
  return {
    context,
    reports: [...reports, markdownReport],
    documents: markdownReport.data?.documents ?? []
  };
}
