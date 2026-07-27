// Client master file + Full ERO Client Status matrix.
// Alphabetical directory, name/ref lookup, and cross-channel status join.
// Zero external deps — joins CRM, refund cases, and SBTPG traces by taxpayerRef.

import { masterfilePipeline } from '../../../pipelines/masterfile-pipeline/src/index.mjs';
import { scoreRefundIntelligence } from '../../ero-ops/src/index.mjs';

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

/** Normalize a person/org name for alphabetical sort and lookup. */
export function normalizeNameKey(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Last-name–first sort key: "Jordan Ellis" → "ellis jordan". */
export function alphabeticalSortKey(name) {
  const key = normalizeNameKey(name);
  if (!key) return '';
  const parts = key.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(' ');
  return `${last} ${rest}`;
}

export const MATRIX_CHANNELS = Object.freeze([
  'crm',
  'refund',
  'sbtpg',
  'efile',
  'overall'
]);

export const OVERALL_STATUS = Object.freeze({
  CLEAR: 'clear',
  IN_PROGRESS: 'in_progress',
  ACTION_NEEDED: 'action_needed',
  UNKNOWN: 'unknown'
});

function compareAlpha(a, b) {
  return alphabeticalSortKey(a).localeCompare(alphabeticalSortKey(b), 'en', { sensitivity: 'base' });
}

/**
 * Client master file store — canonical ERO client directory.
 * Primary identity: taxpayerRef when present, else masterfile id.
 */
export function createMasterfileStore({
  idFactory,
  now = () => new Date().toISOString(),
  maxRecords = 5000
} = {}) {
  const nextId = idFactory ?? defaultId;
  /** @type {Map<string, object>} */
  const byId = new Map();
  /** @type {Map<string, string>} taxpayerRef → id */
  const byTaxpayer = new Map();

  function snapshotRecord(record) {
    return { ...record, tags: [...(record.tags ?? [])] };
  }

  function upsert(input = {}) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('masterfile.name is required.');
    const taxpayerRef = input.taxpayerRef ? String(input.taxpayerRef).trim() : null;
    const existingId =
      (taxpayerRef && byTaxpayer.get(taxpayerRef)) ||
      (input.id && byId.has(String(input.id)) ? String(input.id) : null) ||
      (input.contactId
        ? [...byId.values()].find((r) => r.contactId === input.contactId)?.id
        : null);

    const createdAt = existingId ? byId.get(existingId).createdAt : now();
    const id = existingId ?? nextId('mf');
    const prev = existingId ? byId.get(existingId) : null;

    if (prev?.taxpayerRef && prev.taxpayerRef !== taxpayerRef) {
      byTaxpayer.delete(prev.taxpayerRef);
    }

    const record = {
      id,
      name,
      nameKey: normalizeNameKey(name),
      sortKey: alphabeticalSortKey(name),
      email: String(input.email ?? prev?.email ?? '').trim().toLowerCase(),
      phone: String(input.phone ?? prev?.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20),
      taxpayerRef,
      contactId: input.contactId ?? prev?.contactId ?? null,
      accountId: input.accountId ?? prev?.accountId ?? null,
      clientNumber: String(input.clientNumber ?? input.clientIdNumber ?? prev?.clientNumber ?? '')
        .trim()
        .toUpperCase() || null,
      customerNumber: String(input.customerNumber ?? input.customerIdNumber ?? prev?.customerNumber ?? '')
        .trim()
        .toUpperCase() || null,
      state: String(input.state ?? prev?.state ?? '').trim().toUpperCase() || null,
      locality: String(input.locality ?? input.parish ?? input.county ?? prev?.locality ?? '')
        .trim()
        .toUpperCase() || null,
      address: String(input.address ?? prev?.address ?? '').trim(),
      tags: Array.isArray(input.tags)
        ? [...new Set(input.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 24)
        : prev?.tags ?? [],
      crmStatus: String(input.crmStatus ?? prev?.crmStatus ?? 'active').trim() || 'active',
      notes: String(input.notes ?? prev?.notes ?? '').trim(),
      source: String(input.source ?? prev?.source ?? 'manual').trim() || 'manual',
      letter: alphabeticalSortKey(name).charAt(0).toUpperCase() || '#',
      createdAt,
      updatedAt: now()
    };

    byId.set(id, record);
    if (taxpayerRef) byTaxpayer.set(taxpayerRef, id);
    if (byId.size > maxRecords) {
      const oldest = [...byId.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
      if (oldest) {
        byId.delete(oldest.id);
        if (oldest.taxpayerRef) byTaxpayer.delete(oldest.taxpayerRef);
      }
    }
    return snapshotRecord(record);
  }

  function get(id) {
    const record = byId.get(String(id));
    return record ? snapshotRecord(record) : null;
  }

  function findByTaxpayerRef(taxpayerRef) {
    if (!taxpayerRef) return null;
    const id = byTaxpayer.get(String(taxpayerRef).trim());
    return id ? get(id) : null;
  }

  /**
   * Alphabetical directory with optional letter filter and search query.
   * Lookup fields: name, email, phone, taxpayerRef, locality, tags.
   */
  function list({
    q = '',
    letter = '',
    limit = 200,
    offset = 0,
    sort = 'alpha'
  } = {}) {
    const query = String(q).trim().toLowerCase();
    const letterFilter = String(letter).trim().toUpperCase();
    let pool = [...byId.values()];

    if (letterFilter && letterFilter !== 'ALL' && letterFilter !== '#') {
      pool = pool.filter((r) => r.letter === letterFilter);
    } else if (letterFilter === '#') {
      pool = pool.filter((r) => !/^[A-Z]$/.test(r.letter));
    }

    if (query) {
      pool = pool.filter((r) => {
        const hay = [
          r.name,
          r.email,
          r.phone,
          r.taxpayerRef,
          r.clientNumber,
          r.customerNumber,
          r.state,
          r.locality,
          ...(r.tags ?? [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(query) || r.nameKey.includes(query) || r.sortKey.includes(query);
      });
    }

    if (sort === 'alpha' || sort === 'name') {
      pool.sort((a, b) => compareAlpha(a.name, b.name) || a.id.localeCompare(b.id));
    } else if (sort === 'updated') {
      pool.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    const total = pool.length;
    const rows = pool.slice(offset, offset + limit).map(snapshotRecord);
    const letters = [...new Set([...byId.values()].map((r) => r.letter))].sort();
    return { total, offset, limit, sort: sort || 'alpha', letters, rows };
  }

  /** Prefix / exact name lookup for operator typeahead. */
  function lookupByName(nameQuery, { limit = 20 } = {}) {
    const q = normalizeNameKey(nameQuery);
    if (!q) return [];
    return [...byId.values()]
      .filter((r) => r.nameKey.startsWith(q) || r.nameKey.includes(q) || r.sortKey.startsWith(q))
      .sort((a, b) => compareAlpha(a.name, b.name))
      .slice(0, limit)
      .map(snapshotRecord);
  }

  function remove(id) {
    const record = byId.get(String(id));
    if (!record) return false;
    byId.delete(record.id);
    if (record.taxpayerRef) byTaxpayer.delete(record.taxpayerRef);
    return true;
  }

  function syncFromCrm(crmStore) {
    if (!crmStore?.searchContacts) throw new Error('syncFromCrm requires a CRM store.');
    const contacts = crmStore.searchContacts('', { limit: 5000 });
    let upserted = 0;
    for (const c of contacts) {
      upsert({
        name: c.name,
        email: c.email,
        phone: c.phone,
        taxpayerRef: c.taxpayerRef,
        contactId: c.id,
        accountId: c.accountId,
        state: c.state,
        locality: c.locality,
        address: c.address,
        tags: c.tags,
        crmStatus: c.status,
        notes: c.notes,
        source: c.source || 'crm-sync'
      });
      upserted += 1;
    }
    return { upserted, total: byId.size };
  }

  /**
   * Run masterfile-pipeline stage labels against an approved record input.
   * Scaffold only — normalizes into a masterfile upsert (no live IRS).
   */
  function ingestApprovedRecord(input = {}) {
    const stages = masterfilePipeline.stages.map((stage) => ({ stage, ok: true }));
    const record = upsert({
      ...input,
      source: input.source ?? 'masterfile-pipeline'
    });
    return {
      pipeline: masterfilePipeline.name,
      stages,
      outputs: masterfilePipeline.outputs,
      record
    };
  }

  function snapshot() {
    return { records: byId.size, taxpayers: byTaxpayer.size };
  }

  return {
    upsert,
    get,
    findByTaxpayerRef,
    list,
    lookupByName,
    remove,
    syncFromCrm,
    ingestApprovedRecord,
    snapshot,
    _records: byId
  };
}

function latestTrace(traces, contactId, taxpayerRef) {
  const pool = (traces ?? []).filter(
    (t) =>
      (contactId && t.contactId === contactId) ||
      (taxpayerRef && t.taxpayerRef === taxpayerRef)
  );
  return pool[0] ?? null;
}

function latestRefundCase(cases, taxpayerRef) {
  if (!taxpayerRef) return null;
  const pool = (cases ?? []).filter((c) => c.taxpayerRef === taxpayerRef);
  return pool[0] ?? null;
}

function deriveEfileStatus(refundCase, ledgerHint) {
  if (ledgerHint?.ackCode) {
    const code = String(ledgerHint.ackCode).toUpperCase();
    if (code === 'A') return { stage: 'accepted', label: 'Accepted', ackCode: code };
    if (code === 'R') return { stage: 'rejected', label: 'Rejected', ackCode: code };
    return { stage: 'acknowledged', label: `Ack ${code}`, ackCode: code };
  }
  if (!refundCase) return { stage: 'none', label: 'No e-file signal', ackCode: null };
  const fs = String(refundCase.filingStage ?? '').toLowerCase();
  if (fs === 'paid' || fs === 'sent' || fs === 'approved') {
    return { stage: 'transmitted', label: `Filing ${fs}`, ackCode: null };
  }
  if (fs === 'received' || fs === 'processing') {
    return { stage: 'queued', label: `Filing ${fs}`, ackCode: null };
  }
  if (fs === 'delay' || fs === 'review' || fs === 'offset') {
    return { stage: 'hold', label: `Filing ${fs}`, ackCode: null };
  }
  return { stage: 'unknown', label: refundCase.status || 'unknown', ackCode: null };
}

function rollupOverall({ crmStatus, refund, sbtpg, efile }) {
  const friction =
    /delay|review|offset|hold|reject/i.test(String(refund?.filingStage ?? '')) ||
    /reject/i.test(String(sbtpg?.stage ?? '')) ||
    efile?.stage === 'rejected' ||
    efile?.stage === 'hold';
  if (friction) return OVERALL_STATUS.ACTION_NEEDED;
  const progressing =
    refund?.filingStage ||
    sbtpg?.stage ||
    (efile?.stage && efile.stage !== 'none');
  if (progressing) return OVERALL_STATUS.IN_PROGRESS;
  if (crmStatus === 'active') return OVERALL_STATUS.CLEAR;
  return OVERALL_STATUS.UNKNOWN;
}

/**
 * Build the Full ERO Client Status matrix — one row per masterfile/CRM client.
 * Alphabetical by default. Searchable via `q` (name and identity fields).
 */
export function buildEroClientStatusMatrix({
  masterfile,
  crmStore = null,
  refundCases = [],
  traces = [],
  ledgerHints = [],
  q = '',
  letter = '',
  limit = 200,
  offset = 0
} = {}) {
  if (!masterfile && crmStore) {
    // Ephemeral join from CRM only
    const contacts = crmStore.searchContacts(q, { limit: 5000 });
    const sorted = [...contacts].sort((a, b) => compareAlpha(a.name, b.name));
    const rows = sorted.slice(offset, offset + limit).map((c) => {
      const refund = latestRefundCase(refundCases, c.taxpayerRef);
      const sbtpg = latestTrace(traces, c.id, c.taxpayerRef);
      const ledger = ledgerHints.find((l) => l.taxpayerRef === c.taxpayerRef) ?? null;
      const efile = deriveEfileStatus(refund, ledger);
      const intelligence = scoreRefundIntelligence({
        refundStatus: refund?.filingStage ?? refund?.status,
        sbtpgEnrolled: Boolean(sbtpg),
        hasTranscript: Boolean(refund?.timeline?.length),
        posPaid: Boolean(c.lastSaleId)
      });
      const overall = rollupOverall({
        crmStatus: c.status,
        refund,
        sbtpg,
        efile
      });
      return {
        clientId: c.id,
        masterfileId: null,
        name: c.name,
        letter: alphabeticalSortKey(c.name).charAt(0).toUpperCase() || '#',
        taxpayerRef: c.taxpayerRef,
        email: c.email,
        state: c.state,
        locality: c.locality,
        channels: {
          crm: { status: c.status, contactId: c.id },
          refund: refund
            ? {
                caseId: refund.id ?? refund.caseId,
                status: refund.status,
                filingStage: refund.filingStage,
                amount: refund.amount ?? null
              }
            : { caseId: null, status: 'none', filingStage: null, amount: null },
          sbtpg: sbtpg
            ? {
                traceId: sbtpg.id,
                stage: sbtpg.stage,
                productCode: sbtpg.productCode
              }
            : { traceId: null, stage: 'none', productCode: null },
          efile,
          overall
        },
        intelligence: {
          score: intelligence.score,
          band: intelligence.band,
          recommendation: intelligence.recommendation
        }
      };
    });
    return {
      title: 'Full ERO Client Status Matrix',
      total: sorted.length,
      offset,
      limit,
      q,
      letter,
      channels: MATRIX_CHANNELS,
      overallStatuses: Object.values(OVERALL_STATUS),
      rows
    };
  }

  const listing = masterfile.list({ q, letter, limit, offset, sort: 'alpha' });
  const rows = listing.rows.map((mf) => {
    const contact = mf.contactId && crmStore?.findContact ? crmStore.findContact(mf.contactId) : null;
    const refund = latestRefundCase(refundCases, mf.taxpayerRef);
    const sbtpg = latestTrace(traces, mf.contactId, mf.taxpayerRef);
    const ledger = ledgerHints.find((l) => l.taxpayerRef === mf.taxpayerRef) ?? null;
    const efile = deriveEfileStatus(refund, ledger);
    const intelligence = scoreRefundIntelligence({
      refundStatus: refund?.filingStage ?? refund?.status,
      sbtpgEnrolled: Boolean(sbtpg),
      hasTranscript: Boolean(refund?.timeline?.length),
      posPaid: Boolean(contact?.lastSaleId)
    });
    const overall = rollupOverall({
      crmStatus: mf.crmStatus,
      refund,
      sbtpg,
      efile
    });
    return {
      clientId: mf.contactId,
      masterfileId: mf.id,
      name: mf.name,
      letter: mf.letter,
      taxpayerRef: mf.taxpayerRef,
      email: mf.email,
      state: mf.state,
      locality: mf.locality,
      channels: {
        crm: { status: mf.crmStatus, contactId: mf.contactId },
        refund: refund
          ? {
              caseId: refund.id ?? refund.caseId,
              status: refund.status,
              filingStage: refund.filingStage,
              amount: refund.amount ?? null
            }
          : { caseId: null, status: 'none', filingStage: null, amount: null },
        sbtpg: sbtpg
          ? {
              traceId: sbtpg.id,
              stage: sbtpg.stage,
              productCode: sbtpg.productCode
            }
          : { traceId: null, stage: 'none', productCode: null },
        efile,
        overall
      },
      intelligence: {
        score: intelligence.score,
        band: intelligence.band,
        recommendation: intelligence.recommendation
      }
    };
  });

  return {
    title: 'Full ERO Client Status Matrix',
    total: listing.total,
    offset: listing.offset,
    limit: listing.limit,
    q,
    letter,
    letters: listing.letters,
    channels: MATRIX_CHANNELS,
    overallStatuses: Object.values(OVERALL_STATUS),
    rows
  };
}

export function describeClientMasterfile() {
  return {
    name: '@rtp/client-masterfile',
    version: '0.1.0',
    role: 'Client master file management + Full ERO Client Status matrix',
    features: [
      'Alphabetical client directory (last-name sort)',
      'Lookup by name prefix / taxpayer ref / email / phone',
      'Full ERO status matrix: CRM · Refund · SBTPG · E-file · Overall',
      'Masterfile pipeline ingest scaffold'
    ],
    pipeline: masterfilePipeline.name,
    channels: MATRIX_CHANNELS
  };
}
