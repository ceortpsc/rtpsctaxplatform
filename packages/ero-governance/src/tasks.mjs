import { randomUUID } from 'node:crypto';
import {
  PAID_TASK_STATES,
  PERSONA_REGISTER,
  assertPersonaActionAllowed,
  humanReviewRequired,
  getPersona
} from './index.mjs';
import { getCatalogItem } from './catalog.mjs';

const store = {
  tasks: new Map(),
  events: [],
  payments: new Map()
};

const FORWARD = Object.freeze({
  REQUESTED: ['AUTHENTICATED', 'CANCELLED', 'HOLD', 'FLAG'],
  AUTHENTICATED: ['SCOPED', 'NEEDS_INFO', 'CANCELLED', 'HOLD'],
  SCOPED: ['PRICED', 'NEEDS_INFO', 'CANCELLED', 'HOLD'],
  PRICED: ['PAID_APPROVED', 'CANCELLED', 'HOLD'],
  PAID_APPROVED: ['QUEUED', 'HOLD', 'CANCELLED'],
  QUEUED: ['IN_PROGRESS', 'HOLD', 'CANCELLED'],
  IN_PROGRESS: ['HUMAN_REVIEW', 'NEEDS_INFO', 'FLAG', 'HOLD', 'ESCALATED'],
  HUMAN_REVIEW: ['DELIVERED', 'NEEDS_INFO', 'HOLD', 'ESCALATED', 'FLAG'],
  DELIVERED: ['ACKNOWLEDGED', 'HOLD'],
  ACKNOWLEDGED: ['RETAINED'],
  NEEDS_INFO: ['SCOPED', 'IN_PROGRESS', 'HOLD', 'CANCELLED'],
  FLAG: ['HOLD', 'ESCALATED', 'HUMAN_REVIEW', 'CANCELLED'],
  HOLD: ['ESCALATED', 'CANCELLED', 'DISENGAGED'],
  ESCALATED: ['HUMAN_REVIEW', 'HOLD', 'DISENGAGED'],
  CANCELLED: [],
  DISENGAGED: [],
  RETAINED: []
});

function emit(type, payload) {
  const event = {
    id: randomUUID(),
    type,
    at: new Date().toISOString(),
    ...payload
  };
  store.events.unshift(event);
  store.events = store.events.slice(0, 500);
  return event;
}

export function listPersonasLive() {
  return PERSONA_REGISTER.map((persona) => ({
    ...persona,
    status: 'online',
    mode: 'assistive-realtime',
    disclosure: 'You are interacting with an automated AI persona employee under RTP-AI-001.'
  }));
}

export function createHireRequest({
  serviceCode,
  personaId,
  clientReference,
  scopeNotes = '',
  authenticated = false
} = {}) {
  const catalog = getCatalogItem(serviceCode);
  if (!catalog) {
    return { ok: false, code: 'unknown_service', message: `Catalog item ${serviceCode} not found` };
  }
  const persona = getPersona(personaId || catalog.defaultPersona);
  if (!persona) {
    return { ok: false, code: 'unknown_persona', message: 'Persona not registered' };
  }
  if (!persona.permitted.length) {
    return { ok: false, code: 'persona_inactive', message: `${persona.name} has no permitted actions` };
  }

  const review = humanReviewRequired(catalog.risk);
  const task = {
    id: randomUUID(),
    serviceCode: catalog.code,
    serviceName: catalog.name,
    category: catalog.category,
    price: catalog.price,
    currency: catalog.currency,
    unit: catalog.unit,
    personaId: persona.id,
    personaName: persona.name,
    clientReference: clientReference || `client-${randomUUID().slice(0, 8)}`,
    scopeNotes,
    state: authenticated ? 'AUTHENTICATED' : 'REQUESTED',
    risk: catalog.risk,
    humanReview: review,
    paymentStatus: 'unpaid',
    paymentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [],
    outputs: [],
    audit: [],
    holdReason: null,
    governance: {
      policy: 'RTP-AI-001 / AI-002 / FIN-001',
      notice: 'AI personas are assistive. They cannot sign, transmit, clear HOLD, change bank data, or approve refunds without human review.',
      zeroRefund: true
    }
  };

  pushTimeline(task, task.state, `Hire request created for ${catalog.code} assigned to ${persona.name}`);
  store.tasks.set(task.id, task);
  emit('TASK_CREATED', { taskId: task.id, personaId: persona.id, serviceCode: catalog.code });
  return { ok: true, task };
}

function pushTimeline(task, state, note, actor = 'system') {
  task.timeline.push({ at: new Date().toISOString(), state, note, actor });
  task.audit.push({
    at: new Date().toISOString(),
    actor,
    eventType: 'STATE',
    humanReadableSummary: note
  });
  task.state = state;
  task.updatedAt = new Date().toISOString();
}

export function authenticateTask(taskId) {
  return transition(taskId, 'AUTHENTICATED', 'Client/session authenticated for paid task', 'auth-gate');
}

export function scopeTask(taskId, scopeNotes) {
  const task = store.tasks.get(taskId);
  if (!task) return notFound();
  if (scopeNotes) task.scopeNotes = scopeNotes;
  return transition(taskId, 'SCOPED', 'Service scoped under approved catalog questionnaire', task.personaId);
}

export function priceTask(taskId) {
  const task = store.tasks.get(taskId);
  if (!task) return notFound();
  const billingGate = assertPersonaActionAllowed('billing-service-order-agent', 'create_quotes_from_catalog');
  if (!billingGate.ok) return billingGate;
  task.quote = {
    amount: task.price,
    currency: task.currency,
    catalogCode: task.serviceCode,
    disclaimer: 'Premium starting price; signed service order controls final fee. Zero-refund / earned-service policy applies (FIN-001).'
  };
  return transition(taskId, 'PRICED', `Quoted ${task.currency} ${task.price} from catalog ${task.serviceCode}`, 'billing-service-order-agent');
}

export function payTask(taskId, { method = 'card_stub', reference } = {}) {
  const task = store.tasks.get(taskId);
  if (!task) return notFound();
  if (!['PRICED', 'PAID_APPROVED'].includes(task.state) && task.state !== 'PRICED') {
    if (task.state !== 'PRICED') {
      return { ok: false, code: 'invalid_state', message: `Payment only from PRICED (current=${task.state})` };
    }
  }
  if (task.state !== 'PRICED') {
    return { ok: false, code: 'invalid_state', message: `Payment only from PRICED (current=${task.state})` };
  }

  const payment = {
    id: randomUUID(),
    taskId,
    amount: task.price,
    currency: task.currency,
    method,
    reference: reference || `pay-${randomUUID().slice(0, 8)}`,
    status: 'captured_stub',
    capturedAt: new Date().toISOString(),
    policy: 'FIN-001',
    note: 'Deterministic payment stub — connect approved processor after security review. No live card data stored.'
  };
  store.payments.set(payment.id, payment);
  task.paymentId = payment.id;
  task.paymentStatus = 'paid';
  const result = transition(taskId, 'PAID_APPROVED', `Payment captured (${payment.reference})`, 'billing-service-order-agent');
  emit('PAYMENT_CAPTURED', { taskId, paymentId: payment.id, amount: payment.amount });
  return { ...result, payment };
}

export function queueTask(taskId) {
  return transition(taskId, 'QUEUED', 'Paid task queued for AI persona realtime execution', 'supervisor-router');
}

export function runPersonaStep(taskId, { action, message } = {}) {
  const task = store.tasks.get(taskId);
  if (!task) return notFound();

  if (task.state === 'HOLD' || task.state === 'DISENGAGED') {
    return {
      ok: false,
      code: 'hold_locked',
      message: 'AI cannot move a material task out of HOLD/DISENGAGED',
      requiresHuman: true,
      policy: 'RTP-AI-001'
    };
  }

  if (!['PAID_APPROVED', 'QUEUED', 'IN_PROGRESS', 'NEEDS_INFO'].includes(task.state)) {
    return { ok: false, code: 'not_runnable', message: `Task not runnable in state ${task.state}` };
  }

  if (task.paymentStatus !== 'paid') {
    return { ok: false, code: 'payment_required', message: 'Payment approval required before live service execution' };
  }

  const requestedAction = action || taskDefaultAction(task.personaId);
  const gate = assertPersonaActionAllowed(task.personaId, requestedAction);
  if (!gate.ok) {
    pushTimeline(task, 'HOLD', gate.message, task.personaId);
    task.holdReason = gate.message;
    emit('TASK_HOLD', { taskId, reason: gate.message });
    return { ok: false, ...gate, task };
  }

  if (task.state === 'PAID_APPROVED' || task.state === 'QUEUED' || task.state === 'NEEDS_INFO') {
    pushTimeline(task, 'IN_PROGRESS', `Persona ${task.personaName} started realtime work`, task.personaId);
  }

  const output = {
    id: randomUUID(),
    at: new Date().toISOString(),
    personaId: task.personaId,
    action: requestedAction,
    message: message || defaultPersonaMessage(task, requestedAction),
    confidence: task.risk === 'low' ? 0.82 : task.risk === 'moderate' ? 0.68 : 0.55,
    disclaimer: 'Automated assistive output under RTP-AI-001. Not a final tax/legal conclusion.',
    sources: ['RTP-MASTER-002', 'service-catalog', 'approved-questionnaire']
  };
  task.outputs.push(output);
  task.audit.push({
    at: output.at,
    actor: task.personaId,
    eventType: 'PERSONA_OUTPUT',
    humanReadableSummary: output.message
  });

  const review = humanReviewRequired(task.risk);
  if (review.required) {
    pushTimeline(task, 'HUMAN_REVIEW', `Routed to human review (${review.mode})`, 'supervisor-router');
    emit('HUMAN_REVIEW_REQUIRED', { taskId, mode: review.mode });
  }

  emit('PERSONA_STEP', { taskId, personaId: task.personaId, action: requestedAction });
  return { ok: true, task, output, humanReview: review };
}

export function humanApprove(taskId, { reviewer = 'ero-manager', note = 'Human approved delivery' } = {}) {
  const task = store.tasks.get(taskId);
  if (!task) return notFound();
  if (task.state !== 'HUMAN_REVIEW' && task.state !== 'HOLD') {
    return { ok: false, code: 'invalid_state', message: `Human approve expects HUMAN_REVIEW/HOLD (current=${task.state})` };
  }
  if (task.state === 'HOLD') {
    // Only humans clear HOLD
    pushTimeline(task, 'HUMAN_REVIEW', `HOLD cleared by ${reviewer}: ${note}`, reviewer);
  }
  pushTimeline(task, 'DELIVERED', note, reviewer);
  emit('TASK_DELIVERED', { taskId, reviewer });
  return { ok: true, task };
}

export function placeHold(taskId, reason = 'Material governance HOLD') {
  const task = store.tasks.get(taskId);
  if (!task) return notFound();
  task.holdReason = reason;
  pushTimeline(task, 'HOLD', reason, 'supervisor-router');
  emit('TASK_HOLD', { taskId, reason });
  return { ok: true, task };
}

export function getTask(taskId) {
  return store.tasks.get(taskId) || null;
}

export function listTasks() {
  return [...store.tasks.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listEvents({ limit = 50 } = {}) {
  return store.events.slice(0, limit);
}

export function taskStates() {
  return [...PAID_TASK_STATES];
}

function transition(taskId, next, note, actor) {
  const task = store.tasks.get(taskId);
  if (!task) return notFound();
  const allowed = FORWARD[task.state] || [];
  if (!allowed.includes(next)) {
    return { ok: false, code: 'invalid_transition', message: `Cannot move ${task.state} → ${next}` };
  }
  if (task.state === 'HOLD' && actor !== 'ero-manager' && actor !== 'human-reviewer' && !String(actor).includes('manager')) {
    // AI cannot clear HOLD — only explicit human approve path clears
    if (next !== 'ESCALATED' && next !== 'CANCELLED' && next !== 'DISENGAGED') {
      return {
        ok: false,
        code: 'hold_locked',
        message: 'AI cannot move a material task out of HOLD',
        requiresHuman: true
      };
    }
  }
  pushTimeline(task, next, note, actor);
  emit('TASK_TRANSITION', { taskId, state: next, actor });
  return { ok: true, task };
}

function notFound() {
  return { ok: false, code: 'not_found', message: 'Task not found' };
}

function taskDefaultAction(personaId) {
  const persona = getPersona(personaId);
  return persona?.permitted?.[0] || 'general_service_qa';
}

function defaultPersonaMessage(task, action) {
  return `${task.personaName} executed '${action}' for ${task.serviceCode} (${task.serviceName}) on behalf of ERO workflow under human oversight. Client ref ${task.clientReference}.`;
}

export function __resetStoreForTests() {
  store.tasks.clear();
  store.events.length = 0;
  store.payments.clear();
}
