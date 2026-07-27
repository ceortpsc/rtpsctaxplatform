import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processWebhook,
  parsePayload,
  normalizeIdentifier,
  normalizeTimestamp,
  normalizeStatusCode,
  ACTION_HANDLERS,
  automationAgentDescriptor
} from '../packages/automation-agent/src/index.mjs';

const FIXED_NOW = '2026-07-27T12:00:00.000Z';

test('RossTax normalizers are deterministic', () => {
  assert.equal(normalizeIdentifier('  case 42 '), 'CASE-42');
  assert.equal(normalizeTimestamp('2026-07-27T12:00:00Z'), '2026-07-27T12:00:00.000Z');
  assert.equal(normalizeStatusCode('Refund_Approved'), 'refund-approved');
  assert.equal(normalizeTimestamp('not-a-date'), null);
});

test('parsePayload rejects malformed JSON and non-objects', () => {
  assert.equal(parsePayload('{').ok, false);
  assert.equal(parsePayload('[]').ok, false);
  assert.equal(parsePayload(null).ok, false);
  assert.equal(parsePayload('{"event_type":"create"}').ok, true);
});

test('incomplete webhook payloads are rejected with structured errors', () => {
  const result = processWebhook({ automationId: '3065c81f-89b2-11f1-b532-320a589b8025' }, { now: () => FIXED_NOW });
  assert.equal(result.status, 'rejected');
  assert.equal(result.action_taken, 'reject');
  assert.equal(result.normalized_payload, null);
  assert.equal(result.error.code, 'payload_incomplete');
  assert.ok(result.error.validation_errors.some((e) => e.field === 'event_type'));
  assert.ok(result.error.validation_errors.some((e) => e.field === 'event_id'));
  assert.ok(Array.isArray(result.logs));
  assert.ok(result.logs.every((row) => row.ts === FIXED_NOW));
});

test('create handler routes and redacts sensitive fields', () => {
  const result = processWebhook(
    {
      event_type: 'create',
      event_id: 'evt-100',
      occurred_at: '2026-07-27T11:00:00Z',
      data: {
        id: 'res-9',
        ssn: '123-45-6789',
        label: 'demo'
      }
    },
    { now: () => FIXED_NOW }
  );
  assert.equal(result.status, 'ok');
  assert.equal(result.action_taken, 'create');
  assert.equal(result.normalized_payload.event_id, 'EVT-100');
  assert.equal(result.normalized_payload.resource_id, 'RES-9');
  assert.equal(result.normalized_payload.schema_version, 'rtpsc.webhook.v1');
  assert.equal(result.normalized_payload.data.ssn, undefined);
  assert.equal(result.normalized_payload.data.label, 'demo');
  assert.equal(result.handler_result.created, true);
});

test('each action handler is reachable', () => {
  for (const action of ACTION_HANDLERS) {
    const result = processWebhook(
      { event_type: action, event_id: `id-${action}`, data: { id: `r-${action}` } },
      { now: () => FIXED_NOW }
    );
    assert.equal(result.status, 'ok', action);
    assert.equal(result.action_taken, action);
  }
});

test('automation agent descriptor is catalog-ready', () => {
  assert.equal(automationAgentDescriptor.name, 'automation-agent');
  assert.deepEqual(automationAgentDescriptor.handlers, [...ACTION_HANDLERS]);
});
