// @rtp/sri-efin — SRI (Secure Registration & Identity) EFIN provider scaffolding.
//
// Models the IRS Authorized e-file Provider identity used to transmit returns:
//   - EFIN  (Electronic Filing Identification Number) — 6 digits.
//   - ETIN  (Electronic Transmitter Identification Number) — 5 digits (optional).
//   - Provider type, firm, responsible official, and a suitability lifecycle.
//
// This is an executable scaffold (dependency-free, Node built-ins only). It does
// NOT perform any real IRS e-Services / suitability calls — provider identity and
// EFIN activation must be verified through the approved IRS channels before any
// production transmission. The persistent registry is backed by @rtp/rtp-datastore.

import crypto from 'node:crypto';

/** IRS Authorized e-file Provider roles (a provider may hold several). */
export const PROVIDER_TYPES = Object.freeze([
  'ero', // Electronic Return Originator
  'transmitter',
  'software-developer',
  'reporting-agent',
  'intermediate-service-provider'
]);

/** Suitability / application lifecycle for an EFIN provider record. */
export const EFIN_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'suitability-pending',
  'active',
  'inactive',
  'suspended',
  'rejected'
]);

/** Allowed status transitions (fail-safe: unknown transitions are rejected). */
const STATUS_TRANSITIONS = Object.freeze({
  draft: ['submitted'],
  submitted: ['suitability-pending', 'rejected'],
  'suitability-pending': ['active', 'rejected'],
  active: ['inactive', 'suspended'],
  inactive: ['active', 'suspended'],
  suspended: ['active', 'inactive'],
  rejected: ['draft']
});

const EFIN_RE = /^\d{6}$/;
const ETIN_RE = /^\d{5}$/;

function nowIso() {
  return new Date().toISOString();
}

function normalizeDigits(value) {
  return String(value ?? '').replace(/[\s-]/g, '');
}

/** Validate an EFIN (6 digits, not all zeros). */
export function validateEfin(efin) {
  const normalized = normalizeDigits(efin);
  if (!EFIN_RE.test(normalized)) {
    return { ok: false, code: 'invalid_efin', message: 'EFIN must be exactly 6 digits.' };
  }
  if (/^0{6}$/.test(normalized)) {
    return { ok: false, code: 'invalid_efin', message: 'EFIN cannot be all zeros.' };
  }
  return { ok: true, efin: normalized };
}

/** Validate an ETIN (5 digits) — optional field. */
export function validateEtin(etin) {
  if (etin === undefined || etin === null || etin === '') return { ok: true, etin: null };
  const normalized = normalizeDigits(etin);
  if (!ETIN_RE.test(normalized)) {
    return { ok: false, code: 'invalid_etin', message: 'ETIN must be exactly 5 digits.' };
  }
  return { ok: true, etin: normalized };
}

function maskEfin(efin) {
  const normalized = normalizeDigits(efin);
  return EFIN_RE.test(normalized) ? `${normalized.slice(0, 2)}••${normalized.slice(-2)}` : '••••••';
}

function defaultId() {
  return `efin_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Build a validated EFIN provider record (status starts at "draft").
 * Throws on invalid EFIN/ETIN/provider type so callers can surface 400s.
 */
export function createEfinRecord(input = {}, { now = nowIso, idFactory } = {}) {
  const efinCheck = validateEfin(input.efin);
  if (!efinCheck.ok) throw Object.assign(new Error(efinCheck.message), { code: efinCheck.code });

  const etinCheck = validateEtin(input.etin);
  if (!etinCheck.ok) throw Object.assign(new Error(etinCheck.message), { code: etinCheck.code });

  const firmName = String(input.firmName ?? '').trim();
  if (!firmName) throw Object.assign(new Error('firmName is required.'), { code: 'invalid_firm' });

  const providerTypes = Array.isArray(input.providerTypes) ? input.providerTypes : [input.providerType];
  const normalizedTypes = providerTypes
    .map((type) => String(type ?? '').trim().toLowerCase())
    .filter(Boolean);
  if (normalizedTypes.length === 0) normalizedTypes.push('ero');
  const invalidType = normalizedTypes.find((type) => !PROVIDER_TYPES.includes(type));
  if (invalidType) {
    throw Object.assign(new Error(`Unknown provider type "${invalidType}".`), { code: 'invalid_provider_type' });
  }

  const responsible = input.responsibleOfficial ?? {};
  const createdAt = now();
  return {
    id: (idFactory ?? defaultId)(),
    efin: efinCheck.efin,
    efinMasked: maskEfin(efinCheck.efin),
    etin: etinCheck.etin,
    firmName,
    providerTypes: normalizedTypes,
    responsibleOfficial: {
      name: String(responsible.name ?? '').trim(),
      title: String(responsible.title ?? '').trim(),
      email: String(responsible.email ?? '').trim().toLowerCase()
    },
    accountId: input.accountId ?? null,
    status: 'draft',
    history: [{ status: 'draft', at: createdAt, note: 'Record created.' }],
    createdAt,
    updatedAt: createdAt
  };
}

/** Whether a status transition is allowed. */
export function canTransition(from, to) {
  return Boolean(STATUS_TRANSITIONS[from]?.includes(to));
}

/** Apply a validated status transition, returning a new record object. */
export function transitionEfinStatus(record, to, { now = nowIso, note } = {}) {
  if (!record) throw Object.assign(new Error('record is required.'), { code: 'invalid_record' });
  if (!EFIN_STATUSES.includes(to)) {
    throw Object.assign(new Error(`Unknown status "${to}".`), { code: 'invalid_status' });
  }
  if (!canTransition(record.status, to)) {
    throw Object.assign(new Error(`Cannot transition from "${record.status}" to "${to}".`), {
      code: 'invalid_transition'
    });
  }
  const at = now();
  return {
    ...record,
    status: to,
    history: [...(record.history ?? []), { status: to, at, note: note ?? '' }],
    updatedAt: at
  };
}

/** Public (masked) projection safe for API/UI responses. */
export function publicEfinRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    efinMasked: record.efinMasked ?? maskEfin(record.efin),
    etin: record.etin,
    firmName: record.firmName,
    providerTypes: record.providerTypes,
    responsibleOfficial: record.responsibleOfficial,
    accountId: record.accountId,
    status: record.status,
    history: record.history,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

/**
 * Persistent EFIN provider registry backed by a @rtp/rtp-datastore instance.
 * @param {object} options
 * @param {object} options.db  A datastore instance (from createDatabase).
 */
export function createEfinRegistry({ db, now = nowIso, idFactory } = {}) {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('createEfinRegistry requires a datastore instance ("db").');
  }
  const providers = db.collection('efin_providers');

  return Object.freeze({
    register(input = {}) {
      let record;
      try {
        record = createEfinRecord(input, { now, idFactory });
      } catch (error) {
        return { ok: false, code: error.code ?? 'invalid_record', message: error.message };
      }
      if (providers.findOne({ efin: record.efin })) {
        return { ok: false, code: 'efin_exists', message: 'That EFIN is already registered.' };
      }
      const saved = providers.insert(record);
      return { ok: true, provider: publicEfinRecord(saved) };
    },

    get(id) {
      return publicEfinRecord(providers.getById(id));
    },

    byEfin(efin) {
      const normalized = normalizeDigits(efin);
      return publicEfinRecord(providers.findOne({ efin: normalized }));
    },

    list({ accountId } = {}) {
      const all = accountId ? providers.find({ accountId }) : providers.all();
      return all.map(publicEfinRecord);
    },

    transition(id, to, meta = {}) {
      const current = providers.getById(id);
      if (!current) return { ok: false, code: 'not_found', message: 'EFIN record not found.' };
      let next;
      try {
        next = transitionEfinStatus(current, to, { now, note: meta.note });
      } catch (error) {
        return { ok: false, code: error.code ?? 'invalid_transition', message: error.message };
      }
      const saved = providers.update(id, { status: next.status, history: next.history });
      return { ok: true, provider: publicEfinRecord(saved) };
    },

    count() {
      return providers.count();
    }
  });
}

export const __testing = { maskEfin, normalizeDigits, STATUS_TRANSITIONS };
