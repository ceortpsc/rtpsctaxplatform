// Automation agent core: deterministic webhook parse → validate → normalize → route.
// Dependency-free (Node built-ins only). Never retains sensitive taxpayer fields.

/** Allowed workflow action handlers. */
export const ACTION_HANDLERS = Object.freeze(['create', 'update', 'sync', 'generate', 'notify']);

/** Explicit workflow defaults (never invent values outside this map). */
export const WORKFLOW_DEFAULTS = Object.freeze({
  schema_version: 'rtpsc.webhook.v1',
  source: 'webhook',
  status_code: 'accepted'
});

/** Field names stripped before any retention or outbound normalized payload. */
export const SENSITIVE_FIELD_NAMES = Object.freeze([
  'ssn',
  'itin',
  'tin',
  'ein',
  'tax_id',
  'taxId',
  'taxpayer_ssn',
  'bank_account',
  'bankAccount',
  'account_number',
  'accountNumber',
  'routing_number',
  'routingNumber',
  'password',
  'secret',
  'client_secret',
  'clientSecret',
  'api_secret',
  'apiSecret',
  'token',
  'access_token',
  'refresh_token',
  'authorization'
]);

const SENSITIVE_SET = new Set(SENSITIVE_FIELD_NAMES.map((n) => n.toLowerCase()));

/**
 * RossTax identifier normalization: trim, collapse whitespace to '-', uppercase.
 * Empty / non-string values become null (caller decides requiredness).
 */
export function normalizeIdentifier(value) {
  if (value == null) return null;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return null;
  }
  const trimmed = String(value).trim().replace(/\s+/g, '-');
  if (trimmed === '') return null;
  return trimmed.toUpperCase();
}

/**
 * RossTax timestamp normalization: ISO-8601 UTC. Rejects unparseable values.
 */
export function normalizeTimestamp(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * RossTax status code normalization: trim, lowercase, kebab-case.
 */
export function normalizeStatusCode(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return raw === '' ? null : raw;
}

function createLog(level, action, detail = {}) {
  return {
    ts: null, // filled by processWebhook with injected now()
    level,
    action,
    ...detail
  };
}

function redactSensitive(value, depth = 0) {
  if (depth > 8) return null;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_SET.has(String(key).toLowerCase())) continue;
      out[key] = redactSensitive(nested, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Safely parse an incoming payload. Accepts objects or JSON strings.
 * @returns {{ ok: true, payload: object } | { ok: false, error: object }}
 */
export function parsePayload(raw) {
  if (raw == null) {
    return {
      ok: false,
      error: {
        code: 'payload_missing',
        message: 'Webhook payload is missing.'
      }
    };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return {
        ok: false,
        error: {
          code: 'payload_empty',
          message: 'Webhook payload string is empty.'
        }
      };
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          ok: false,
          error: {
            code: 'payload_not_object',
            message: 'Webhook JSON must deserialize to a plain object.'
          }
        };
      }
      return { ok: true, payload: parsed };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'payload_malformed_json',
          message: 'Webhook payload is not valid JSON.',
          detail: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      error: {
        code: 'payload_not_object',
        message: 'Webhook payload must be a plain object or JSON string.'
      }
    };
  }
  return { ok: true, payload: raw };
}

function resolveEventType(payload) {
  const raw = payload.event_type ?? payload.eventType ?? payload.action ?? null;
  if (raw == null) return null;
  const normalized = normalizeStatusCode(raw);
  if (!normalized) return null;
  // Allow dotted forms like "refund.create" → last segment is the handler.
  const segments = normalized.split('-').join('.').split('.');
  const leaf = segments[segments.length - 1];
  if (ACTION_HANDLERS.includes(leaf)) return leaf;
  if (ACTION_HANDLERS.includes(normalized)) return normalized;
  return null;
}

function collectValidationErrors(payload) {
  const errors = [];
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push({ field: 'payload', code: 'required', message: 'Payload object is required.' });
    return errors;
  }
  const eventType = resolveEventType(payload);
  if (!eventType) {
    errors.push({
      field: 'event_type',
      code: 'required',
      message: `event_type is required and must resolve to one of: ${ACTION_HANDLERS.join(', ')}.`
    });
  }
  const eventId = normalizeIdentifier(payload.event_id ?? payload.eventId ?? payload.id ?? null);
  if (!eventId) {
    errors.push({
      field: 'event_id',
      code: 'required',
      message: 'event_id (or id) is required and must be a non-empty identifier.'
    });
  }
  if (payload.occurred_at != null || payload.occurredAt != null) {
    const ts = normalizeTimestamp(payload.occurred_at ?? payload.occurredAt);
    if (!ts) {
      errors.push({
        field: 'occurred_at',
        code: 'invalid',
        message: 'occurred_at must be a parseable ISO-8601 timestamp when provided.'
      });
    }
  }
  if (payload.status_code != null || payload.statusCode != null) {
    const status = normalizeStatusCode(payload.status_code ?? payload.statusCode);
    if (!status) {
      errors.push({
        field: 'status_code',
        code: 'invalid',
        message: 'status_code must normalize to a non-empty RossTax status code when provided.'
      });
    }
  }
  return errors;
}

function buildNormalizedPayload(payload, { nowIso }) {
  const eventType = resolveEventType(payload);
  const eventId = normalizeIdentifier(payload.event_id ?? payload.eventId ?? payload.id);
  const occurredAt =
    normalizeTimestamp(payload.occurred_at ?? payload.occurredAt) ?? nowIso; // explicit default: processing clock
  const statusCode =
    normalizeStatusCode(payload.status_code ?? payload.statusCode) ?? WORKFLOW_DEFAULTS.status_code;
  const correlationId =
    normalizeIdentifier(payload.correlation_id ?? payload.correlationId) ?? eventId; // explicit default
  const sourceRaw = payload.source;
  const source =
    typeof sourceRaw === 'string' && sourceRaw.trim() !== ''
      ? normalizeStatusCode(sourceRaw) ?? WORKFLOW_DEFAULTS.source
      : WORKFLOW_DEFAULTS.source;

  const dataIn = payload.data ?? payload.payload ?? {};
  const safeData =
    dataIn && typeof dataIn === 'object' && !Array.isArray(dataIn) ? redactSensitive(dataIn) : {};

  const resourceId = normalizeIdentifier(
    payload.resource_id ?? payload.resourceId ?? safeData.resource_id ?? safeData.id ?? null
  );

  return {
    schema_version: WORKFLOW_DEFAULTS.schema_version,
    event_type: eventType,
    event_id: eventId,
    correlation_id: correlationId,
    occurred_at: occurredAt,
    status_code: statusCode,
    source,
    resource_id: resourceId,
    data: safeData
  };
}

function handlerResult(eventType, normalized) {
  switch (eventType) {
    case 'create':
      return {
        action_taken: 'create',
        handler: 'create',
        result: {
          resource_id: normalized.resource_id,
          created: true,
          status_code: normalized.status_code
        }
      };
    case 'update':
      return {
        action_taken: 'update',
        handler: 'update',
        result: {
          resource_id: normalized.resource_id,
          updated: true,
          status_code: normalized.status_code
        }
      };
    case 'sync':
      return {
        action_taken: 'sync',
        handler: 'sync',
        result: {
          resource_id: normalized.resource_id,
          synced: true,
          status_code: normalized.status_code
        }
      };
    case 'generate':
      return {
        action_taken: 'generate',
        handler: 'generate',
        result: {
          resource_id: normalized.resource_id,
          generated: true,
          artifact_kind: normalizeStatusCode(normalized.data.artifact_kind) ?? 'document',
          status_code: normalized.status_code
        }
      };
    case 'notify':
      return {
        action_taken: 'notify',
        handler: 'notify',
        result: {
          resource_id: normalized.resource_id,
          notified: true,
          channel: normalizeStatusCode(normalized.data.channel) ?? 'system',
          status_code: normalized.status_code
        }
      };
    default:
      return {
        action_taken: 'reject',
        handler: null,
        result: null
      };
  }
}

/**
 * Process one webhook payload deterministically.
 * @param {unknown} raw
 * @param {{ now?: () => string }} [options]
 * @returns {object} Final machine-readable result: status, action_taken, normalized_payload, logs [, error]
 */
export function processWebhook(raw, options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const nowIso = normalizeTimestamp(now()) ?? new Date().toISOString();
  const logs = [];

  const stamp = (entry) => {
    const row = { ...entry, ts: nowIso };
    logs.push(row);
    return row;
  };

  stamp(createLog('info', 'parse.start', { compliance: 'irs-efile-data-handling' }));

  const parsed = parsePayload(raw);
  if (!parsed.ok) {
    stamp(createLog('error', 'parse.reject', { code: parsed.error.code }));
    return {
      status: 'rejected',
      action_taken: 'reject',
      normalized_payload: null,
      error: parsed.error,
      logs
    };
  }

  stamp(createLog('info', 'parse.ok', {}));
  stamp(createLog('info', 'validate.start', {}));

  const validationErrors = collectValidationErrors(parsed.payload);
  if (validationErrors.length > 0) {
    stamp(
      createLog('error', 'validate.reject', {
        error_count: validationErrors.length,
        fields: validationErrors.map((e) => e.field)
      })
    );
    return {
      status: 'rejected',
      action_taken: 'reject',
      normalized_payload: null,
      error: {
        code: 'payload_incomplete',
        message: 'Webhook payload failed required-field validation.',
        validation_errors: validationErrors
      },
      logs
    };
  }

  stamp(createLog('info', 'validate.ok', {}));
  stamp(createLog('info', 'normalize.start', {}));

  const normalized_payload = buildNormalizedPayload(parsed.payload, { nowIso });
  stamp(
    createLog('info', 'normalize.ok', {
      event_type: normalized_payload.event_type,
      event_id: normalized_payload.event_id
    })
  );

  stamp(createLog('info', 'route.start', { handler: normalized_payload.event_type }));
  const routed = handlerResult(normalized_payload.event_type, normalized_payload);
  stamp(
    createLog('info', 'route.ok', {
      action_taken: routed.action_taken,
      handler: routed.handler
    })
  );
  stamp(createLog('info', 'complete', { status: 'ok' }));

  return {
    status: 'ok',
    action_taken: routed.action_taken,
    normalized_payload,
    handler_result: routed.result,
    logs
  };
}

/** Descriptor for module catalog / build manifest. */
export const automationAgentDescriptor = Object.freeze({
  name: 'automation-agent',
  domain: 'automations',
  responsibilities: [
    'Parse and validate inbound webhook JSON payloads.',
    'Normalize identifiers, timestamps, and status codes to RossTax standards.',
    'Route create/update/sync/generate/notify events deterministically.',
    'Emit audit-grade logs without retaining sensitive taxpayer fields.'
  ],
  handlers: [...ACTION_HANDLERS],
  defaults: { ...WORKFLOW_DEFAULTS }
});
