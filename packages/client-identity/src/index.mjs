// Full API + TDS client identity: provision, authenticate, audit.
// Credentials come from environment and/or issued local clients.
// Secrets are never returned from list/status APIs or written to audit logs.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';
import { clientIdentityPlaceholders, clientConfigGovernance } from '../../client-config/src/index.mjs';

export { clientIdentityPlaceholders, clientConfigGovernance };

const API_SCOPES = Object.freeze(['api:read', 'api:write', 'refund:read', 'refund:ingest', 'refund:admin']);
const TDS_SCOPES = Object.freeze(['tds:pull', 'tds:normalize', 'refund:ingest']);

export const CLIENT_KINDS = Object.freeze(['api', 'tds']);

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

function hashSecret(secret) {
  return createHash('sha256').update(String(secret)).digest('hex');
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function redactId(id) {
  const s = String(id ?? '');
  if (s.length <= 8) return `${s.slice(0, 2)}***`;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function generateClientId(kind) {
  const prefix = kind === 'tds' ? 'rtp_tds' : 'rtp_api';
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

function generateSecret() {
  return `rtp_sk_${randomBytes(24).toString('base64url')}`;
}

function scopesFor(kind) {
  return kind === 'tds' ? [...TDS_SCOPES] : [...API_SCOPES];
}

/**
 * Create a client registry. Seeds from API_CLIENT_* / TDS_CLIENT_* env when set.
 * Optional filePath persists issued clients (secrets hashed) for local ops.
 */
export function createClientRegistry({
  env = process.env,
  now = () => new Date().toISOString(),
  idFactory,
  auditPath = path.resolve(process.cwd(), 'logs', 'client-auth-audit.jsonl'),
  registryPath = path.resolve(process.cwd(), 'logs', 'client-registry.json'),
  persist = true
} = {}) {
  const nextId = idFactory ?? ((p) => defaultId(p));
  /** @type {Map<string, object>} */
  const clients = new Map();
  const audit = [];

  function publicClient(record) {
    return {
      id: record.id,
      kind: record.kind,
      name: record.name,
      scopes: [...record.scopes],
      status: record.status,
      source: record.source,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
      idHint: redactId(record.id)
    };
  }

  async function writeAudit(entry) {
    audit.unshift(entry);
    if (audit.length > 2000) audit.length = 2000;
    if (!persist) return entry;
    try {
      await mkdir(path.dirname(auditPath), { recursive: true });
      await appendFile(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      entry.persistError = true;
    }
    return entry;
  }

  async function persistRegistry() {
    if (!persist) return;
    const payload = {
      company: PLATFORM_IDENTITY.company,
      updatedAt: now(),
      clients: [...clients.values()].map((c) => ({
        id: c.id,
        kind: c.kind,
        name: c.name,
        scopes: c.scopes,
        status: c.status,
        source: c.source,
        secretHash: c.secretHash,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt
      }))
    };
    try {
      await mkdir(path.dirname(registryPath), { recursive: true });
      await writeFile(registryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    } catch {
      // non-fatal
    }
  }

  function putClient(record) {
    clients.set(record.id, record);
  }

  function seedFromEnv() {
    const seeded = [];
    const pairs = [
      {
        kind: 'api',
        id: env.API_CLIENT_ID,
        secret: env.API_CLIENT_SECRET,
        name: 'Environment API client'
      },
      {
        kind: 'tds',
        id: env.TDS_CLIENT_ID,
        secret: env.TDS_CLIENT_SECRET,
        name: 'Environment TDS client'
      }
    ];
    for (const pair of pairs) {
      if (!pair.id || pair.id === 'unset' || !pair.secret || pair.secret === 'unset' || pair.secret.startsWith('replace-in-')) {
        continue;
      }
      const record = {
        id: String(pair.id),
        kind: pair.kind,
        name: pair.name,
        scopes: scopesFor(pair.kind),
        status: 'active',
        source: 'environment',
        secretHash: hashSecret(pair.secret),
        createdAt: now(),
        lastUsedAt: null
      };
      putClient(record);
      seeded.push(publicClient(record));
    }
    return seeded;
  }

  async function loadPersisted() {
    if (!persist) return [];
    try {
      const raw = JSON.parse(await readFile(registryPath, 'utf8'));
      const loaded = [];
      for (const c of raw.clients ?? []) {
        if (clients.has(c.id)) continue;
        putClient({ ...c, scopes: c.scopes ?? scopesFor(c.kind) });
        loaded.push(publicClient(clients.get(c.id)));
      }
      return loaded;
    } catch {
      return [];
    }
  }

  /**
   * Issue a full API or TDS client. Returns the one-time plaintext secret.
   */
  async function issueClient({ kind = 'api', name, clientId, clientSecret, source = 'issued' } = {}) {
    if (!CLIENT_KINDS.includes(kind)) throw new Error(`kind must be one of: ${CLIENT_KINDS.join(', ')}`);
    const id = clientId ? String(clientId) : generateClientId(kind);
    if (clients.has(id)) throw new Error(`Client id already exists: ${id}`);
    const secret = clientSecret ? String(clientSecret) : generateSecret();
    const createdAt = now();
    const record = {
      id,
      kind,
      name: String(name ?? `${kind.toUpperCase()} client`).trim() || `${kind} client`,
      scopes: scopesFor(kind),
      status: 'active',
      source,
      secretHash: hashSecret(secret),
      createdAt,
      lastUsedAt: null
    };
    putClient(record);
    await persistRegistry();
    await writeAudit({
      id: nextId('caud'),
      event: 'client_issued',
      outcome: 'success',
      clientIdHint: redactId(id),
      kind,
      source,
      at: createdAt
    });
    return {
      client: publicClient(record),
      credentials: {
        clientId: id,
        clientSecret: secret,
        kind,
        envHints:
          kind === 'api'
            ? { API_CLIENT_ID: id, API_CLIENT_SECRET: '(set from issued secret)' }
            : { TDS_CLIENT_ID: id, TDS_CLIENT_SECRET: '(set from issued secret)' }
      },
      notice: 'Store the client secret now — it is not retrievable later.'
    };
  }

  async function revokeClient(clientId) {
    const record = clients.get(clientId);
    if (!record) throw new Error(`Unknown client: ${clientId}`);
    record.status = 'revoked';
    await persistRegistry();
    await writeAudit({
      id: nextId('caud'),
      event: 'client_revoked',
      outcome: 'success',
      clientIdHint: redactId(clientId),
      kind: record.kind,
      at: now()
    });
    return publicClient(record);
  }

  async function authenticate({ clientId, clientSecret, kind, requiredScope, meta = {} } = {}) {
    const at = now();
    const record = clients.get(String(clientId ?? ''));
    const fail = async (code, message) => {
      await writeAudit({
        id: nextId('caud'),
        event: 'auth_attempt',
        outcome: 'failure',
        code,
        clientIdHint: redactId(clientId),
        kind: kind ?? record?.kind ?? null,
        source: meta.source ?? 'api',
        ip: meta.ip ?? null,
        at
      });
      return { ok: false, code, message, client: null };
    };

    if (!record) return fail('unknown_client', 'Unknown client id.');
    if (kind && record.kind !== kind) return fail('kind_mismatch', `Client is kind "${record.kind}", expected "${kind}".`);
    if (record.status !== 'active') return fail('revoked', 'Client has been revoked.');
    if (!safeEqualHex(hashSecret(clientSecret ?? ''), record.secretHash)) {
      return fail('invalid_secret', 'Invalid client secret.');
    }
    if (requiredScope && !record.scopes.includes(requiredScope)) {
      return fail('insufficient_scope', `Missing required scope: ${requiredScope}`);
    }

    record.lastUsedAt = at;
    await writeAudit({
      id: nextId('caud'),
      event: 'auth_attempt',
      outcome: 'success',
      code: 'authenticated',
      clientIdHint: redactId(record.id),
      kind: record.kind,
      source: meta.source ?? 'api',
      ip: meta.ip ?? null,
      scope: requiredScope ?? null,
      at
    });

    return {
      ok: true,
      code: 'authenticated',
      message: 'Client authenticated.',
      client: publicClient(record)
    };
  }

  function listClients({ kind } = {}) {
    return [...clients.values()]
      .filter((c) => (kind ? c.kind === kind : true))
      .map(publicClient);
  }

  function getClient(clientId) {
    const record = clients.get(clientId);
    return record ? publicClient(record) : null;
  }

  function status() {
    const api = listClients({ kind: 'api' });
    const tds = listClients({ kind: 'tds' });
    return {
      company: PLATFORM_IDENTITY.company,
      placeholders: clientIdentityPlaceholders,
      governance: clientConfigGovernance,
      counts: { api: api.length, tds: tds.length, total: clients.size },
      apiProvisioned: api.some((c) => c.status === 'active'),
      tdsProvisioned: tds.some((c) => c.status === 'active'),
      clients: { api, tds }
    };
  }

  function listAudit({ limit = 50 } = {}) {
    return audit.slice(0, limit);
  }

  /** Ensure at least one active API and TDS client exist (issue local if missing). */
  async function ensureLocalClients() {
    const issued = [];
    if (!listClients({ kind: 'api' }).some((c) => c.status === 'active')) {
      issued.push(await issueClient({ kind: 'api', name: 'Local development API client', source: 'local-auto' }));
    }
    if (!listClients({ kind: 'tds' }).some((c) => c.status === 'active')) {
      issued.push(await issueClient({ kind: 'tds', name: 'Local development TDS client', source: 'local-auto' }));
    }
    return issued;
  }

  // bootstrap
  seedFromEnv();

  return {
    seedFromEnv,
    loadPersisted,
    issueClient,
    revokeClient,
    authenticate,
    listClients,
    getClient,
    status,
    listAudit,
    ensureLocalClients,
    persistRegistry,
    auditPath,
    registryPath,
    _clients: clients
  };
}

/** Parse Basic or Bearer-style client credentials from HTTP headers / body. */
export function extractClientCredentials(request, body = {}) {
  const header = request.headers?.authorization ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx >= 0) {
        return { clientId: decoded.slice(0, idx), clientSecret: decoded.slice(idx + 1) };
      }
    } catch {
      // ignore
    }
  }
  return {
    clientId: body.clientId ?? request.headers?.['x-api-client-id'] ?? null,
    clientSecret: body.clientSecret ?? request.headers?.['x-api-client-secret'] ?? null
  };
}
