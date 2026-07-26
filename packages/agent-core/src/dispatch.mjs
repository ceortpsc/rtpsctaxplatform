// Platform wiring for the agent assignment board (avoids cycles with registry).
import { buildAgentContext, runAgent } from './index.mjs';
import { platformAgents } from './roster.mjs';
import { REQUIRED_ASSIGNMENTS, createAssignmentBoard } from './assignments.mjs';

/** Create the platform assignment board with every development-team agent. */
export function createPlatformAssignmentBoard(overrides = {}) {
  return createAssignmentBoard({
    agents: platformAgents,
    assignments: overrides.assignments ?? REQUIRED_ASSIGNMENTS,
    buildContext: overrides.buildContext ?? buildAgentContext,
    runAgent: overrides.runAgent ?? runAgent,
    now: overrides.now
  });
}

/** Convenience: run all required assignments once and return the board summary. */
export async function runRequiredAssignments(input = {}) {
  const board = createPlatformAssignmentBoard();
  const batch = await board.run({ mode: input.mode ?? 'required', ...input }, { trigger: 'manual' });
  return { board: board.describe(), batch };
}
