// Tax-party identity numbers: Client ID # and Customer ID # issuance.
// Distinct from API/TDS machine credentials in @rtp/client-identity.
// Numbers are human-readable, sequential, and persisted under logs/ (gitignored).

import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';

export const PARTY_ID_KINDS = Object.freeze(['client', 'customer']);

export const PARTY_ID_PREFIX = Object.freeze({
  client: 'CL',
  customer: 'CU'
});

const DEFAULT_PAD = 6;

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

function formatNumber(kind, seq, { pad = DEFAULT_PAD } = {}) {
  const prefix = PARTY_ID_PREFIX[kind];
  if (!prefix) throw new Error(`Unknown party id kind: ${kind}`);
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 1) throw new Error('Sequence must be a positive integer.');
  return `${prefix}-${String(n).padStart(pad, '0')}`;
}

function parseNumber(value) {
  const s = String(value ?? '').trim().toUpperCase();
  const match = s.match(/^(CL|CU)-(\d+)$/);
  if (!match) return null;
  const kind = match[1] === 'CL' ? 'client' : 'customer';
  return { kind, seq: Number(match[2]), number: `${match[1]}-${match[2]}` };
}

/**
 * Issuer for Client ID # (CL-######) and Customer ID # (CU-######).
 * Optional persistence under logs/party-identity-registry.json.
 */
export function createPartyIdentityIssuer({
  now = () => new Date().toISOString(),
  idFactory,
  registryPath = path.resolve(process.cwd(), 'logs', 'party-identity-registry.json'),
  auditPath = path.resolve(process.cwd(), 'logs', 'party-identity-audit.jsonl'),
  persist = true,
  pad = DEFAULT_PAD,
  startAt = 1
} = {}) {
  const nextId = idFactory ?? ((p) => defaultId(p));
  const sequences = { client: Math.max(0, Number(startAt) - 1), customer: Math.max(0, Number(startAt) - 1) };
  /** @type {Map<string, object>} number → record */
  const byNumber = new Map();
  const audit = [];

  function publicRecord(record) {
    return {
      number: record.number,
      kind: record.kind,
      seq: record.seq,
      name: record.name,
      taxpayerRef: record.taxpayerRef,
      contactId: record.contactId,
      masterfileId: record.masterfileId,
      status: record.status,
      source: record.source,
      pairedWith: record.pairedWith,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
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
      product: 'Client ID # / Customer ID # issuance',
      updatedAt: now(),
      sequences: { ...sequences },
      pad,
      records: [...byNumber.values()].map(publicRecord)
    };
    try {
      await mkdir(path.dirname(registryPath), { recursive: true });
      await writeFile(registryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    } catch {
      // non-fatal
    }
  }

  async function loadPersisted() {
    if (!persist) return { loaded: 0 };
    try {
      const raw = JSON.parse(await readFile(registryPath, 'utf8'));
      if (raw.sequences?.client != null) sequences.client = Number(raw.sequences.client) || sequences.client;
      if (raw.sequences?.customer != null) sequences.customer = Number(raw.sequences.customer) || sequences.customer;
      let loaded = 0;
      for (const row of raw.records ?? []) {
        if (!row?.number || byNumber.has(row.number)) continue;
        byNumber.set(row.number, { ...row });
        loaded += 1;
      }
      return { loaded, sequences: { ...sequences } };
    } catch {
      return { loaded: 0, reason: 'missing' };
    }
  }

  function get(number) {
    const record = byNumber.get(String(number ?? '').trim().toUpperCase());
    return record ? publicRecord(record) : null;
  }

  function findByKind(kind, { limit = 100 } = {}) {
    return [...byNumber.values()]
      .filter((r) => r.kind === kind && r.status === 'active')
      .sort((a, b) => b.seq - a.seq)
      .slice(0, limit)
      .map(publicRecord);
  }

  function findForContact(contactId) {
    return [...byNumber.values()]
      .filter((r) => r.contactId === contactId && r.status === 'active')
      .map(publicRecord);
  }

  /**
   * Issue the next Client ID # (CL-######) or Customer ID # (CU-######).
   */
  async function issue({
    kind,
    name = null,
    taxpayerRef = null,
    contactId = null,
    masterfileId = null,
    source = 'issued',
    number: requested = null,
    pairedWith = null
  } = {}) {
    if (!PARTY_ID_KINDS.includes(kind)) {
      throw new Error(`kind must be one of: ${PARTY_ID_KINDS.join(', ')}`);
    }

    let number;
    let seq;
    if (requested) {
      const parsed = parseNumber(requested);
      if (!parsed || parsed.kind !== kind) {
        throw new Error(`Invalid ${kind} id # format. Expected ${PARTY_ID_PREFIX[kind]}-######`);
      }
      number = formatNumber(kind, parsed.seq, { pad });
      seq = parsed.seq;
      if (byNumber.has(number)) throw new Error(`${kind} id # already issued: ${number}`);
      if (seq > sequences[kind]) sequences[kind] = seq;
    } else {
      sequences[kind] += 1;
      seq = sequences[kind];
      number = formatNumber(kind, seq, { pad });
      while (byNumber.has(number)) {
        sequences[kind] += 1;
        seq = sequences[kind];
        number = formatNumber(kind, seq, { pad });
      }
    }

    const createdAt = now();
    const record = {
      number,
      kind,
      seq,
      name: name ? String(name).trim() : null,
      taxpayerRef: taxpayerRef ? String(taxpayerRef).trim() : null,
      contactId: contactId ?? null,
      masterfileId: masterfileId ?? null,
      status: 'active',
      source,
      pairedWith: pairedWith ?? null,
      createdAt,
      updatedAt: createdAt
    };
    byNumber.set(number, record);
    await persistRegistry();
    await writeAudit({
      id: nextId('pid'),
      event: 'party_id_issued',
      outcome: 'success',
      kind,
      number,
      source,
      contactId,
      at: createdAt
    });

    return {
      record: publicRecord(record),
      label: kind === 'client' ? 'Client ID #' : 'Customer ID #',
      notice: `${kind === 'client' ? 'Client' : 'Customer'} ID # ${number} issued.`
    };
  }

  /** Issue both Client ID # and Customer ID # as a linked pair. */
  async function issuePair(input = {}) {
    const client = await issue({ ...input, kind: 'client' });
    const customer = await issue({
      ...input,
      kind: 'customer',
      pairedWith: client.record.number
    });
    const clientRec = byNumber.get(client.record.number);
    const customerRec = byNumber.get(customer.record.number);
    clientRec.pairedWith = customer.record.number;
    clientRec.updatedAt = now();
    await persistRegistry();
    return {
      clientIdNumber: client.record.number,
      customerIdNumber: customer.record.number,
      client: publicRecord(clientRec),
      customer: publicRecord(customerRec),
      notice: `Issued Client ID # ${client.record.number} and Customer ID # ${customer.record.number}.`
    };
  }

  async function attach(number, patch = {}) {
    const key = String(number ?? '').trim().toUpperCase();
    const record = byNumber.get(key);
    if (!record) throw new Error(`Unknown party id #: ${number}`);
    if (patch.name != null) record.name = String(patch.name).trim() || null;
    if (patch.taxpayerRef != null) record.taxpayerRef = String(patch.taxpayerRef).trim() || null;
    if (patch.contactId != null) record.contactId = patch.contactId;
    if (patch.masterfileId != null) record.masterfileId = patch.masterfileId;
    if (patch.pairedWith != null) record.pairedWith = patch.pairedWith;
    record.updatedAt = now();
    await persistRegistry();
    return publicRecord(record);
  }

  async function revoke(number) {
    const key = String(number ?? '').trim().toUpperCase();
    const record = byNumber.get(key);
    if (!record) throw new Error(`Unknown party id #: ${number}`);
    record.status = 'revoked';
    record.updatedAt = now();
    await persistRegistry();
    await writeAudit({
      id: nextId('pid'),
      event: 'party_id_revoked',
      outcome: 'success',
      kind: record.kind,
      number: record.number,
      at: record.updatedAt
    });
    return publicRecord(record);
  }

  function status() {
    const active = [...byNumber.values()].filter((r) => r.status === 'active');
    return {
      package: '@rtp/party-identity',
      company: PLATFORM_IDENTITY.company,
      kinds: PARTY_ID_KINDS,
      prefixes: PARTY_ID_PREFIX,
      sequences: { ...sequences },
      next: {
        client: formatNumber('client', sequences.client + 1, { pad }),
        customer: formatNumber('customer', sequences.customer + 1, { pad })
      },
      counts: {
        client: active.filter((r) => r.kind === 'client').length,
        customer: active.filter((r) => r.kind === 'customer').length,
        total: active.length,
        revoked: [...byNumber.values()].filter((r) => r.status === 'revoked').length
      },
      registryPath,
      policy: [
        'Client ID # (CL-######) identifies the ERO tax-prep client record.',
        'Customer ID # (CU-######) identifies the billing / POS customer record.',
        'Distinct from API/TDS machine credentials (rtp_api_* / rtp_tds_*).',
        'Numbers persist under logs/ (gitignored); do not commit live registries.'
      ]
    };
  }

  function list({ kind = null, limit = 100 } = {}) {
    let rows = [...byNumber.values()];
    if (kind) rows = rows.filter((r) => r.kind === kind);
    return rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(publicRecord);
  }

  return {
    issue,
    issuePair,
    issueClientIdNumber: (input = {}) => issue({ ...input, kind: 'client' }),
    issueCustomerIdNumber: (input = {}) => issue({ ...input, kind: 'customer' }),
    attach,
    revoke,
    get,
    findByKind,
    findForContact,
    list,
    status,
    loadPersisted,
    persistRegistry,
    parseNumber,
    formatNumber: (kind, seq) => formatNumber(kind, seq, { pad }),
    _byNumber: byNumber,
    _sequences: sequences
  };
}

export function describePartyIdentity() {
  return {
    name: '@rtp/party-identity',
    version: '0.1.0',
    role: 'Issuance of Client ID # and Customer ID #',
    kinds: PARTY_ID_KINDS,
    prefixes: PARTY_ID_PREFIX,
    examples: { client: 'CL-000001', customer: 'CU-000001' },
    commands: [
      './rtpsc ids status',
      './rtpsc ids issue client --name "Jordan Ellis"',
      './rtpsc ids issue customer --name "Jordan Ellis"',
      './rtpsc ids issue pair --name "Jordan Ellis"'
    ],
    distinctFrom: '@rtp/client-identity (API/TDS machine credentials)'
  };
}

export { formatNumber, parseNumber };
