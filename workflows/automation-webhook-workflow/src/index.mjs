import { defineTask, defineWorkflow } from '../../../packages/workflow-engine/src/index.mjs';
import { processWebhook } from '../../../packages/automation-agent/src/index.mjs';

// Event-driven automation webhook workflow. Triggered when an
// `automation.webhook.received` event is emitted. Processing is deterministic
// and never retains sensitive taxpayer fields.

export const processWebhookTask = defineTask({
  name: 'process-webhook',
  description: 'Parse, validate, normalize, and route an inbound automation webhook payload.',
  run: (context) => {
    const result = processWebhook(context.input, {
      now: () => context.input?.__now ?? new Date().toISOString()
    });
    if (result.status !== 'ok') {
      const detail =
        result.error?.code != null
          ? `${result.error.code}: ${result.error.message ?? 'rejected'}`
          : 'webhook rejected';
      throw new Error(detail);
    }
    context.log(
      `Webhook ${result.normalized_payload.event_id} routed as ${result.action_taken}.`
    );
    return {
      webhookStatus: result.status,
      actionTaken: result.action_taken,
      normalizedPayload: result.normalized_payload,
      handlerResult: result.handler_result,
      webhookLogs: result.logs
    };
  }
});

export const emitAutomationEventTask = defineTask({
  name: 'emit-automation-event',
  description: 'Assemble the outbound automation.webhook.processed event payload.',
  run: (context) => ({
    emittedEvent: {
      type: 'automation.webhook.processed',
      eventId: context.state.normalizedPayload.event_id,
      actionTaken: context.state.actionTaken,
      statusCode: context.state.normalizedPayload.status_code,
      resourceId: context.state.normalizedPayload.resource_id
    }
  })
});

export const automationWebhookWorkflow = defineWorkflow({
  name: 'automation-webhook',
  description:
    'Validate and normalize an automation webhook, route to a deterministic handler, and emit a processed event.',
  trigger: { type: 'event', on: 'automation.webhook.received' },
  tags: ['automation', 'webhook', 'event-driven'],
  steps: [processWebhookTask, emitAutomationEventTask]
});
