// @rtp/data-sync — shared table contracts, CSV/JSON import, and cross-service projection.
// Dependency-free scaffold for synchronizing CRM, refund, invoice, tax, and ledger tables.

export {
  TABLE_SCHEMAS,
  TABLE_NAMES,
  getTableSchema,
  listTableSchemas
} from './schemas.mjs';

export { parseCsv, parseCsvLine, normalizeHeader, toCsv } from './csv.mjs';

export { createTableStore, normalizeRow } from './store.mjs';

export {
  projectToCrm,
  projectToRefunds,
  seedTaxRatesFromTaxData
} from './project.mjs';

export {
  createSyncEngine,
  resolveTableName
} from './sync.mjs';

export const DATA_SYNC_POLICY = Object.freeze([
  'Approved CSV/JSON table files only — no scraping and no live IRS/Treasury pulls.',
  'Keep PII under data/sync/ (gitignored). Commit only README + synthetic fixtures.',
  'Upserts are idempotent by each table primary key (taxpayerRef, caseId, invoiceId, …).',
  'Projections into CRM / refund-core do not replace service auth or environment protection gates.'
]);

export function describeDataSync() {
  return {
    name: '@rtp/data-sync',
    version: '0.1.0',
    role: 'Data and table synchronization',
    tables: [
      'clients',
      'refund_cases',
      'invoices',
      'tax_rates',
      'interactions',
      'federal_ledger'
    ],
    commands: ['./rtpsc sync status', './rtpsc sync run', './rtpsc sync import <table> <file>'],
    policy: DATA_SYNC_POLICY
  };
}
