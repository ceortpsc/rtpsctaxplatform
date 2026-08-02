// Canonical table contracts for RTPSC data & table synchronization.
// Column names are stable API surfaces for CSV/JSON import and service projections.

/** @typedef {{ name: string, type: 'string'|'number'|'boolean'|'tags'|'json', required?: boolean, primary?: boolean }} ColumnDef */
/** @typedef {{ name: string, primaryKey: string, columns: ColumnDef[], description: string }} TableSchema */

/** @type {Readonly<Record<string, TableSchema>>} */
export const TABLE_SCHEMAS = Object.freeze({
  clients: Object.freeze({
    name: 'clients',
    primaryKey: 'taxpayerRef',
    description: 'Tax-prep client / contact identity rows shared by CRM, portal import, and refund cases.',
    columns: Object.freeze([
      Object.freeze({ name: 'taxpayerRef', type: 'string', required: true, primary: true }),
      Object.freeze({ name: 'name', type: 'string', required: true }),
      Object.freeze({ name: 'email', type: 'string' }),
      Object.freeze({ name: 'phone', type: 'string' }),
      Object.freeze({ name: 'state', type: 'string' }),
      Object.freeze({ name: 'locality', type: 'string' }),
      Object.freeze({ name: 'address', type: 'string' }),
      Object.freeze({ name: 'tags', type: 'tags' }),
      Object.freeze({ name: 'notes', type: 'string' }),
      Object.freeze({ name: 'source', type: 'string' })
    ])
  }),
  refund_cases: Object.freeze({
    name: 'refund_cases',
    primaryKey: 'caseId',
    description: 'Refund case projection rows keyed for refund-status and ERO dashboards.',
    columns: Object.freeze([
      Object.freeze({ name: 'caseId', type: 'string', required: true, primary: true }),
      Object.freeze({ name: 'taxpayerRef', type: 'string', required: true }),
      Object.freeze({ name: 'filingStage', type: 'string' }),
      Object.freeze({ name: 'status', type: 'string' }),
      Object.freeze({ name: 'amount', type: 'number' }),
      Object.freeze({ name: 'source', type: 'string' }),
      Object.freeze({ name: 'returnId', type: 'string' }),
      Object.freeze({ name: 'ackCode', type: 'string' })
    ])
  }),
  invoices: Object.freeze({
    name: 'invoices',
    primaryKey: 'invoiceId',
    description: 'Invoice draft/settled rows for POS and invoicing machine sync.',
    columns: Object.freeze([
      Object.freeze({ name: 'invoiceId', type: 'string', required: true, primary: true }),
      Object.freeze({ name: 'clientName', type: 'string', required: true }),
      Object.freeze({ name: 'taxpayerRef', type: 'string' }),
      Object.freeze({ name: 'status', type: 'string' }),
      Object.freeze({ name: 'subtotal', type: 'number' }),
      Object.freeze({ name: 'tax', type: 'number' }),
      Object.freeze({ name: 'total', type: 'number' }),
      Object.freeze({ name: 'state', type: 'string' }),
      Object.freeze({ name: 'locality', type: 'string' })
    ])
  }),
  tax_rates: Object.freeze({
    name: 'tax_rates',
    primaryKey: 'jurisdictionKey',
    description: 'State + locality tax rate rows (reference/stub; mirrors @rtp/tax-data).',
    columns: Object.freeze([
      Object.freeze({ name: 'jurisdictionKey', type: 'string', required: true, primary: true }),
      Object.freeze({ name: 'state', type: 'string', required: true }),
      Object.freeze({ name: 'locality', type: 'string' }),
      Object.freeze({ name: 'kind', type: 'string' }),
      Object.freeze({ name: 'stateRate', type: 'number' }),
      Object.freeze({ name: 'localRate', type: 'number' }),
      Object.freeze({ name: 'combinedRate', type: 'number' }),
      Object.freeze({ name: 'city', type: 'string' })
    ])
  }),
  interactions: Object.freeze({
    name: 'interactions',
    primaryKey: 'interactionId',
    description: 'CRM interaction timeline rows linked by taxpayerRef.',
    columns: Object.freeze([
      Object.freeze({ name: 'interactionId', type: 'string', required: true, primary: true }),
      Object.freeze({ name: 'taxpayerRef', type: 'string', required: true }),
      Object.freeze({ name: 'type', type: 'string' }),
      Object.freeze({ name: 'channel', type: 'string' }),
      Object.freeze({ name: 'note', type: 'string' }),
      Object.freeze({ name: 'at', type: 'string' })
    ])
  }),
  federal_ledger: Object.freeze({
    name: 'federal_ledger',
    primaryKey: 'returnId',
    description: 'Normalized Full Report Export ledger rows (no live PII in repo fixtures).',
    columns: Object.freeze([
      Object.freeze({ name: 'returnId', type: 'string', required: true, primary: true }),
      Object.freeze({ name: 'taxpayerRef', type: 'string' }),
      Object.freeze({ name: 'lastFour', type: 'string' }),
      Object.freeze({ name: 'firstName', type: 'string' }),
      Object.freeze({ name: 'lastName', type: 'string' }),
      Object.freeze({ name: 'ackCode', type: 'string' }),
      Object.freeze({ name: 'refund', type: 'number' }),
      Object.freeze({ name: 'transmitDate', type: 'string' }),
      Object.freeze({ name: 'fundedDate', type: 'string' }),
      Object.freeze({ name: 'ptin', type: 'string' })
    ])
  })
});

export const TABLE_NAMES = Object.freeze(Object.keys(TABLE_SCHEMAS));

export function getTableSchema(name) {
  if (!name) return null;
  return TABLE_SCHEMAS[String(name).trim()] ?? null;
}

export function listTableSchemas() {
  return TABLE_NAMES.map((name) => ({ ...TABLE_SCHEMAS[name], columns: [...TABLE_SCHEMAS[name].columns] }));
}
