import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineTask, defineWorkflow } from '../../../packages/workflow-engine/src/index.mjs';
import {
  activateProduction,
  activationHeartbeat,
  writeActivationReceipt
} from '../../../packages/production-activation/src/index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const resolveActivationContextTask = defineTask({
  name: 'resolve-activation-context',
  description: 'Normalize activation request input and trigger metadata.',
  run: (context) => {
    const input = context.input ?? {};
    const trigger = context.trigger || 'manual';
    const mode = input.mode || 'automated';
    context.log?.(`Activation context mode=${mode} trigger=${trigger}`);
    return {
      activationRequest: {
        mode,
        trigger,
        skipGates: Boolean(input.skipGates),
        onlyGates: input.onlyGates || null,
        evidence: input.evidence || {},
        requestedBy: input.requestedBy || 'workflow-automation',
        forceBlock: Boolean(input.forceBlock)
      }
    };
  }
});

const runAutomatedActivationTask = defineTask({
  name: 'run-automated-activation',
  description: 'Execute fully automated production activation gates and write receipts.',
  run: async (context) => {
    const request = context.state.activationRequest || context.input || {};
    const result = await activateProduction(repoRoot, {
      ...request,
      trigger: context.trigger || request.trigger || 'manual'
    });
    if (!result.ok) {
      throw new Error(
        `Production activation blocked (${result.state}): ${(result.gaps || []).join(',') || 'gate failure'}`
      );
    }
    context.log?.(`Activation state=${result.state} receipt=${result.receipt.outPath}`);
    return {
      activation: {
        ok: result.ok,
        state: result.state,
        productionVerified: result.productionVerified,
        gaps: result.gaps,
        receipt: result.receipt,
        gateSummary: (result.gates?.results || []).map((g) => ({ id: g.id, ok: g.ok, skipped: g.skipped }))
      },
      emitEvents: result.events
    };
  }
});

const publishActivationEventsTask = defineTask({
  name: 'publish-activation-events',
  description: 'Record follow-on activation events for downstream listeners.',
  run: async (context) => {
    const events = context.state.emitEvents || [];
    // Persist an event ledger receipt for automation observability.
    const ledger = await writeActivationReceipt(repoRoot, {
      kind: 'production-activation-events',
      trigger: context.trigger || 'manual',
      parentState: context.state.activation?.state,
      events
    });
    context.log?.(`Published ${events.length} activation event(s).`);
    return { eventLedger: ledger, publishedEvents: events };
  }
});

const dispatchActivationAgentTask = defineTask({
  name: 'dispatch-activation-agent',
  description: 'Run the staging-agent activate-production assignment for an operator report.',
  run: async (context) => {
    try {
      const { createPlatformAssignmentBoard } = await import(
        '../../../packages/agent-core/src/dispatch.mjs'
      );
      const board = createPlatformAssignmentBoard();
      const batch = await board.run(
        { assignmentId: 'activate-production' },
        { trigger: 'event:production.activation.requested', triggerType: 'event' }
      );
      context.log?.(`Activation agent batch executed=${batch.executed} failed=${batch.failed}`);
      return {
        activationAgent: {
          ok: batch.failed === 0,
          executed: batch.executed,
          failed: batch.failed,
          results: batch.results.map((r) => ({
            assignmentId: r.assignmentId,
            agent: r.agent,
            status: r.status
          }))
        }
      };
    } catch (error) {
      // Non-blocking: activation gates already succeeded.
      context.log?.(`Activation agent dispatch skipped: ${error.message}`);
      return { activationAgent: { ok: true, skipped: true, reason: error.message } };
    }
  }
});

const activationHeartbeatTask = defineTask({
  name: 'activation-heartbeat',
  description: 'Periodic readiness heartbeat for production activation automation.',
  run: async (context) => {
    const beat = await activationHeartbeat(repoRoot);
    if (!beat.ok) {
      throw new Error(`Activation heartbeat failed: ${beat.checks.filter((c) => !c.ok).map((c) => c.id).join(',')}`);
    }
    context.log?.(`Heartbeat ok; latestState=${beat.latestState}`);
    return { heartbeat: beat };
  }
});

const summarizeActivationTask = defineTask({
  name: 'summarize-activation',
  description: 'Emit a compact activation summary for workflow history.',
  run: (context) => ({
    summary: {
      state: context.state.activation?.state || context.state.heartbeat?.latestState || 'PROPOSED',
      ok: context.state.activation?.ok ?? context.state.heartbeat?.ok ?? false,
      productionVerified: context.state.activation?.productionVerified === true,
      receipt: context.state.activation?.receipt?.outPath || null,
      events: (context.state.publishedEvents || []).map((e) => e.name),
      agent: context.state.activationAgent || null
    }
  })
});

/** Manual full activation dispatch. */
export const productionActivationDispatchWorkflow = defineWorkflow({
  name: 'production-activation-dispatch',
  description: 'Manually dispatch fully automated production activation gates and receipts.',
  trigger: { type: 'manual' },
  tags: ['production', 'activation', 'automated', 'manual'],
  steps: [
    resolveActivationContextTask,
    runAutomatedActivationTask,
    publishActivationEventsTask,
    dispatchActivationAgentTask,
    summarizeActivationTask
  ]
});

/** Event-driven activation on production.activation.requested */
export const productionActivationRequestedWorkflow = defineWorkflow({
  name: 'production-activation-requested',
  description: 'Event-triggered automated production activation.',
  trigger: { type: 'event', on: 'production.activation.requested' },
  tags: ['production', 'activation', 'automated', 'event'],
  steps: [
    resolveActivationContextTask,
    runAutomatedActivationTask,
    publishActivationEventsTask,
    dispatchActivationAgentTask,
    summarizeActivationTask
  ]
});

/** Scheduled heartbeat / readiness cycle */
export const productionActivationCycleWorkflow = defineWorkflow({
  name: 'production-activation-cycle',
  description: 'Scheduled production-activation readiness heartbeat.',
  trigger: {
    type: 'schedule',
    everyMs: 180000,
    input: { mode: 'heartbeat' }
  },
  tags: ['production', 'activation', 'schedule', 'heartbeat'],
  steps: [activationHeartbeatTask, summarizeActivationTask]
});

export const productionActivationWorkflows = [
  productionActivationDispatchWorkflow,
  productionActivationRequestedWorkflow,
  productionActivationCycleWorkflow
];
