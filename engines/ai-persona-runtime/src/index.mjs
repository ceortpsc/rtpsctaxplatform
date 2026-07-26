import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';
import {
  createHireRequest,
  authenticateTask,
  scopeTask,
  priceTask,
  payTask,
  queueTask,
  runPersonaStep,
  humanApprove,
  listPersonasLive,
  listTasks,
  listEvents,
  governanceBanner
} from '../../../packages/ero-governance/src/index.mjs';

export const aiPersonaRuntime = createEngineDescriptor({
  name: 'ai-persona-runtime',
  capabilities: [
    'realtime-persona-presence',
    'hire-for-service',
    'payment-gated-execution',
    'governance-enforced-actions',
    'human-in-the-loop-override',
    'audit-narrative-logging'
  ],
  outputs: ['persona-presence', 'paid-task', 'persona-output', 'governance-event']
});

/**
 * End-to-end hire → pay → realtime persona step under ERO governance.
 */
export function hireAndRunLiveService({
  serviceCode,
  personaId,
  clientReference,
  scopeNotes,
  paymentReference,
  autoHumanApprove = false
} = {}) {
  const hire = createHireRequest({
    serviceCode,
    personaId,
    clientReference,
    scopeNotes,
    authenticated: true
  });
  if (!hire.ok) return hire;

  let taskId = hire.task.id;
  const steps = [];

  const scoped = scopeTask(taskId, scopeNotes || `Scoped ${serviceCode} for ERO-assisted delivery`);
  steps.push(scoped);
  if (!scoped.ok) return { ok: false, stage: 'scope', ...scoped, steps };

  const priced = priceTask(taskId);
  steps.push(priced);
  if (!priced.ok) return { ok: false, stage: 'price', ...priced, steps };

  const paid = payTask(taskId, { reference: paymentReference });
  steps.push(paid);
  if (!paid.ok) return { ok: false, stage: 'pay', ...paid, steps };

  const queued = queueTask(taskId);
  steps.push(queued);
  if (!queued.ok) return { ok: false, stage: 'queue', ...queued, steps };

  const ran = runPersonaStep(taskId, {});
  steps.push(ran);
  if (!ran.ok) return { ok: false, stage: 'run', ...ran, steps };

  let approved = null;
  if (ran.task.state === 'HUMAN_REVIEW' && autoHumanApprove) {
    approved = humanApprove(taskId, {
      reviewer: 'ero-manager',
      note: 'Prototype auto human-approve flag enabled for demo only'
    });
    steps.push(approved);
  }

  return {
    ok: true,
    engine: aiPersonaRuntime.name,
    governance: governanceBanner(),
    personasOnline: listPersonasLive().length,
    task: (approved?.task || ran.task),
    output: ran.output,
    payment: paid.payment,
    steps: steps.map((step) => ({ ok: step.ok, state: step.task?.state, code: step.code }))
  };
}

export function runtimeSnapshot() {
  return {
    engine: aiPersonaRuntime.name,
    governance: governanceBanner(),
    personas: listPersonasLive(),
    openTasks: listTasks().slice(0, 25),
    recentEvents: listEvents({ limit: 25 })
  };
}
