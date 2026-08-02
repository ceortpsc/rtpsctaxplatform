import { listStates, listLocalities } from '../../tax-data/src/index.mjs';

/**
 * Seed tax_rates table from @rtp/tax-data reference rates (idempotent).
 */
export function seedTaxRatesFromTaxData(tableStore) {
  const rows = [];
  for (const state of listStates()) {
    rows.push({
      jurisdictionKey: state.code,
      state: state.code,
      locality: '',
      kind: 'state',
      stateRate: state.rate,
      localRate: 0,
      combinedRate: state.rate,
      city: ''
    });
    for (const loc of listLocalities(state.code)) {
      rows.push({
        jurisdictionKey: `${state.code}:${loc.code}`,
        state: state.code,
        locality: loc.code,
        kind: loc.kind,
        stateRate: state.rate,
        localRate: loc.rate,
        combinedRate: Number((state.rate + loc.rate + (loc.cityRate ?? 0)).toFixed(4)),
        city: loc.city ?? ''
      });
    }
  }
  const result = tableStore.upsertMany('tax_rates', rows, { source: 'tax-data-seed' });
  return {
    summary: { inserted: result.inserted, updated: result.updated, errors: result.errors.length },
    result
  };
}

/**
 * Project clients + interactions tables into a CRM store.
 * Matches existing contacts by taxpayerRef; creates when missing.
 */
export function projectToCrm(tableStore, crmStore) {
  if (!crmStore) throw new Error('projectToCrm requires a CRM store.');
  const clients = tableStore.list('clients', { limit: 5000 });
  const interactions = tableStore.list('interactions', { limit: 5000 });
  let created = 0;
  let updated = 0;
  let linked = 0;
  const byTaxpayer = new Map();

  for (const contact of crmStore.searchContacts?.('') ?? []) {
    if (contact.taxpayerRef) byTaxpayer.set(String(contact.taxpayerRef), contact);
  }

  for (const row of clients) {
    const ref = String(row.taxpayerRef);
    const existing = byTaxpayer.get(ref);
    if (existing) {
      crmStore.updateContact?.(existing.id, {
        name: row.name || existing.name,
        email: row.email || existing.email,
        phone: row.phone || existing.phone,
        state: row.state || existing.state,
        locality: row.locality || existing.locality,
        address: row.address || existing.address,
        tags: row.tags?.length ? row.tags : existing.tags,
        notes: row.notes || existing.notes,
        taxpayerRef: ref
      });
      updated += 1;
      byTaxpayer.set(ref, crmStore.findContact(existing.id));
    } else {
      const contact = crmStore.createContact({
        name: row.name,
        email: row.email,
        phone: row.phone,
        taxpayerRef: ref,
        state: row.state,
        locality: row.locality,
        address: row.address,
        tags: row.tags,
        notes: row.notes,
        source: row.source || 'data-sync'
      });
      created += 1;
      byTaxpayer.set(ref, contact);
    }
  }

  for (const row of interactions) {
    const contact = byTaxpayer.get(String(row.taxpayerRef));
    if (!contact) continue;
    if (typeof crmStore.logInteraction === 'function') {
      crmStore.logInteraction({
        contactId: contact.id,
        type: row.type || 'note',
        channel: row.channel || 'sync',
        subject: row.type || 'sync',
        body: row.note || ''
      });
      linked += 1;
    }
  }

  return {
    summary: { clients: clients.length, created, updated, interactionsLinked: linked },
    created,
    updated,
    linked
  };
}

/**
 * Project refund_cases (+ optional federal_ledger links) into a refund store.
 * Uses ingestEvent when available; falls back to ensureCase-like shapes.
 */
export async function projectToRefunds(tableStore, refundStore) {
  if (!refundStore) throw new Error('projectToRefunds requires a refund store.');
  const cases = tableStore.list('refund_cases', { limit: 5000 });
  const ledger = tableStore.list('federal_ledger', { limit: 5000 });
  const ledgerByReturn = new Map(ledger.map((r) => [String(r.returnId), r]));
  let ingested = 0;
  let errors = 0;
  const results = [];

  for (const row of cases) {
    try {
      const ledgerRow = row.returnId ? ledgerByReturn.get(String(row.returnId)) : null;
      const payload = {
        caseId: row.caseId,
        taxpayerRef: row.taxpayerRef,
        filingStage: row.filingStage || 'received',
        amount: row.amount ?? ledgerRow?.refund ?? null,
        source: row.source || 'data-sync',
        status: row.status
      };
      if (typeof refundStore.ingestEvent === 'function') {
        const result = await refundStore.ingestEvent(payload, { source: 'data-sync' });
        results.push({ caseId: row.caseId, ok: true, status: result?.case?.status ?? result?.status });
      } else if (typeof refundStore.ingestCase === 'function') {
        const result = await refundStore.ingestCase({
          ...payload,
          ledger: ledgerRow ?? undefined
        });
        results.push({ caseId: row.caseId, ok: true, status: result?.status });
      } else {
        throw new Error('Refund store lacks ingestEvent/ingestCase.');
      }
      ingested += 1;
    } catch (error) {
      errors += 1;
      results.push({ caseId: row.caseId, ok: false, error: error.message });
    }
  }

  // Federal ledger rows without an explicit refund_cases row still create a case.
  for (const row of ledger) {
    const caseId = `FED-${String(row.returnId).slice(0, 8).toUpperCase()}`;
    const already = cases.some((c) => c.caseId === caseId || c.returnId === row.returnId);
    if (already) continue;
    try {
      const taxpayerRef = row.taxpayerRef || (row.lastFour ? `TP-****${row.lastFour}` : 'unknown');
      const payload = {
        caseId,
        taxpayerRef,
        filingStage: row.fundedDate ? 'paid' : row.ackCode === 'A' ? 'approved' : 'received',
        amount: row.refund,
        source: 'federal-ledger-sync'
      };
      if (typeof refundStore.ingestEvent === 'function') {
        await refundStore.ingestEvent(payload, { source: 'data-sync-ledger' });
      } else if (typeof refundStore.ingestCase === 'function') {
        await refundStore.ingestCase({ ...payload, ledger: row });
      }
      ingested += 1;
      results.push({ caseId, ok: true, from: 'federal_ledger' });
    } catch (error) {
      errors += 1;
      results.push({ caseId, ok: false, error: error.message });
    }
  }

  return {
    summary: { cases: cases.length, ledger: ledger.length, ingested, errors },
    results
  };
}
