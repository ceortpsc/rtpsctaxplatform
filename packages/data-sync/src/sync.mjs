import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCsv } from './csv.mjs';
import { TABLE_NAMES, getTableSchema, listTableSchemas } from './schemas.mjs';
import { createTableStore } from './store.mjs';
import { projectToCrm, projectToRefunds, seedTaxRatesFromTaxData } from './project.mjs';

const TABLE_FILE_ALIASES = Object.freeze({
  clients: 'clients',
  client: 'clients',
  contacts: 'clients',
  refund_cases: 'refund_cases',
  refunds: 'refund_cases',
  cases: 'refund_cases',
  invoices: 'invoices',
  invoice: 'invoices',
  tax_rates: 'tax_rates',
  tax: 'tax_rates',
  rates: 'tax_rates',
  interactions: 'interactions',
  federal_ledger: 'federal_ledger',
  federal: 'federal_ledger',
  ledger: 'federal_ledger'
});

export function resolveTableName(nameOrFile) {
  const base = String(nameOrFile ?? '')
    .trim()
    .replace(/\.(csv|json)$/i, '')
    .toLowerCase()
    .replace(/-/g, '_');
  return TABLE_FILE_ALIASES[base] ?? (TABLE_NAMES.includes(base) ? base : null);
}

/**
 * Create the data & table synchronization engine.
 * Owns the shared table store and can import CSV/JSON then project into live service stores.
 */
export function createSyncEngine(options = {}) {
  const store = options.store ?? createTableStore(options);
  const now = options.now ?? (() => new Date().toISOString());

  function importRows(tableName, rows, meta = {}) {
    const schema = getTableSchema(tableName);
    if (!schema) throw new Error(`Unknown table: ${tableName}`);
    const result = store.upsertMany(tableName, rows, {
      source: meta.source ?? 'import-rows'
    });
    const run = store.recordRun({
      action: 'import-rows',
      table: tableName,
      inserted: result.inserted,
      updated: result.updated,
      errors: result.errors.length,
      source: meta.source ?? 'import-rows'
    });
    return { ...result, run };
  }

  function importCsvText(tableName, csvText, meta = {}) {
    const schema = getTableSchema(tableName);
    if (!schema) throw new Error(`Unknown table: ${tableName}`);
    const parsed = parseCsv(csvText);
    return importRows(tableName, parsed.rows, {
      source: meta.source ?? 'import-csv',
      headers: parsed.headers
    });
  }

  async function importFile(filePath, meta = {}) {
    const resolvedTable = meta.table ?? resolveTableName(path.basename(filePath));
    if (!resolvedTable) {
      throw new Error(`Cannot infer table from filename: ${path.basename(filePath)}`);
    }
    const text = await readFile(filePath, 'utf8');
    if (/\.json$/i.test(filePath)) {
      const payload = JSON.parse(text);
      const rows = Array.isArray(payload) ? payload : payload.rows ?? payload.data ?? [];
      return importRows(resolvedTable, rows, { source: meta.source ?? `file:${path.basename(filePath)}` });
    }
    return importCsvText(resolvedTable, text, { source: meta.source ?? `file:${path.basename(filePath)}` });
  }

  async function syncDirectory(dirPath, meta = {}) {
    const dir = path.resolve(dirPath);
    let entries = [];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return {
          directory: dir,
          imported: [],
          skipped: [],
          message: 'Sync directory missing — create data/sync and drop CSV/JSON table files.'
        };
      }
      throw error;
    }

    const imported = [];
    const skipped = [];
    for (const name of entries.sort()) {
      if (name.startsWith('.') || name === 'README.md' || name === 'store.json' || name === 'fixtures') {
        skipped.push({ name, reason: 'ignored' });
        continue;
      }
      if (!/\.(csv|json)$/i.test(name)) {
        skipped.push({ name, reason: 'unsupported_extension' });
        continue;
      }
      const table = resolveTableName(name);
      if (!table) {
        skipped.push({ name, reason: 'unknown_table' });
        continue;
      }
      const result = await importFile(path.join(dir, name), {
        table,
        source: meta.source ?? `dir:${name}`
      });
      imported.push({ file: name, table, ...result });
    }

    const run = store.recordRun({
      action: 'sync-directory',
      directory: dir,
      files: imported.length,
      skipped: skipped.length,
      counts: store.count()
    });

    return { directory: dir, imported, skipped, run, counts: store.count() };
  }

  async function project({ crmStore = null, refundStore = null, includeTaxSeed = true } = {}) {
    const projections = {};
    if (includeTaxSeed) {
      projections.tax_rates = seedTaxRatesFromTaxData(store);
    }
    if (crmStore) {
      projections.crm = projectToCrm(store, crmStore);
    }
    if (refundStore) {
      projections.refunds = await projectToRefunds(store, refundStore);
    }
    const run = store.recordRun({
      action: 'project',
      targets: Object.keys(projections),
      summary: Object.fromEntries(
        Object.entries(projections).map(([k, v]) => [k, v.summary ?? v])
      )
    });
    return { projections, run, counts: store.count() };
  }

  async function runFullSync({
    directory,
    crmStore = null,
    refundStore = null,
    persist = true,
    includeTaxSeed = true
  } = {}) {
    const dirResult = directory ? await syncDirectory(directory) : { imported: [], skipped: [], counts: store.count() };
    const projection = await project({ crmStore, refundStore, includeTaxSeed });
    let persistResult = { persisted: false };
    if (persist) persistResult = await store.persist();
    return {
      at: now(),
      directory: dirResult,
      projection,
      persist: persistResult,
      counts: store.count(),
      tables: listTableSchemas().map((t) => ({ name: t.name, primaryKey: t.primaryKey, count: store.count(t.name) }))
    };
  }

  function status() {
    return {
      package: '@rtp/data-sync',
      tables: listTableSchemas().map((t) => ({
        name: t.name,
        primaryKey: t.primaryKey,
        description: t.description,
        columns: t.columns.map((c) => c.name),
        count: store.count(t.name)
      })),
      runs: store.listRuns({ limit: 10 }),
      persistPath: store.persistPath,
      policy: [
        'Approved CSV/JSON table files only — no scraping.',
        'PII table dumps must stay under data/sync (gitignored except fixtures/README).',
        'Projections are idempotent upserts keyed by each table primary key.'
      ]
    };
  }

  return {
    store,
    importRows,
    importCsvText,
    importFile,
    syncDirectory,
    project,
    runFullSync,
    status,
    listTableSchemas
  };
}

export { createTableStore, parseCsv, TABLE_NAMES, getTableSchema, listTableSchemas };
