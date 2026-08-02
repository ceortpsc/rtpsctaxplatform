import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TABLE_NAMES, TABLE_SCHEMAS, getTableSchema } from './schemas.mjs';

function coerceValue(type, value) {
  if (value == null || value === '') return type === 'number' ? null : type === 'tags' ? [] : type === 'boolean' ? false : '';
  switch (type) {
    case 'number': {
      const n = Number(String(value).replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean':
      return /^(1|true|yes|y)$/i.test(String(value).trim());
    case 'tags':
      if (Array.isArray(value)) return value.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
      return String(value)
        .split(/[|;,]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    case 'json':
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(String(value));
      } catch {
        return { raw: String(value) };
      }
    default:
      return String(value).trim();
  }
}

/** Normalize a loose row against a table schema (drop unknown keys, coerce types). */
export function normalizeRow(tableName, input = {}) {
  const schema = getTableSchema(tableName);
  if (!schema) throw new Error(`Unknown table: ${tableName}`);
  const row = {};
  for (const col of schema.columns) {
    const raw =
      input[col.name] ??
      input[col.name.toLowerCase()] ??
      (col.primary ? input.id : undefined);
    row[col.name] = coerceValue(col.type, raw);
  }
  for (const col of schema.columns) {
    if (col.required && (row[col.name] == null || row[col.name] === '')) {
      throw new Error(`${tableName}.${col.name} is required.`);
    }
  }
  return row;
}

/**
 * In-memory multi-table store with optional JSON persistence under data/sync/.
 */
export function createTableStore({
  now = () => new Date().toISOString(),
  persistPath = null,
  maxRowsPerTable = 5000
} = {}) {
  /** @type {Record<string, Map<string, object>>} */
  const tables = Object.fromEntries(TABLE_NAMES.map((name) => [name, new Map()]));
  const runs = [];

  function primaryOf(tableName, row) {
    const schema = TABLE_SCHEMAS[tableName];
    return String(row[schema.primaryKey]);
  }

  function upsert(tableName, input, meta = {}) {
    const schema = getTableSchema(tableName);
    if (!schema) throw new Error(`Unknown table: ${tableName}`);
    const row = normalizeRow(tableName, input);
    const key = primaryOf(tableName, row);
    const existing = tables[tableName].get(key);
    const next = {
      ...row,
      _syncedAt: now(),
      _source: meta.source ?? existing?._source ?? 'manual',
      _revision: (existing?._revision ?? 0) + 1
    };
    tables[tableName].set(key, next);
    if (tables[tableName].size > maxRowsPerTable) {
      const oldest = [...tables[tableName].keys()].slice(0, tables[tableName].size - maxRowsPerTable);
      for (const k of oldest) tables[tableName].delete(k);
    }
    return { key, created: !existing, row: { ...next } };
  }

  function upsertMany(tableName, rows, meta = {}) {
    const results = { table: tableName, inserted: 0, updated: 0, errors: [] };
    for (const [index, input] of rows.entries()) {
      try {
        const result = upsert(tableName, input, meta);
        if (result.created) results.inserted += 1;
        else results.updated += 1;
      } catch (error) {
        results.errors.push({ index, message: error.message });
      }
    }
    return results;
  }

  function get(tableName, key) {
    const map = tables[tableName];
    if (!map) throw new Error(`Unknown table: ${tableName}`);
    const row = map.get(String(key));
    return row ? { ...row } : null;
  }

  function list(tableName, { limit = 100, offset = 0 } = {}) {
    const map = tables[tableName];
    if (!map) throw new Error(`Unknown table: ${tableName}`);
    return [...map.values()]
      .sort((a, b) => String(b._syncedAt).localeCompare(String(a._syncedAt)))
      .slice(offset, offset + limit)
      .map((row) => ({ ...row }));
  }

  function count(tableName) {
    if (tableName) {
      const map = tables[tableName];
      if (!map) throw new Error(`Unknown table: ${tableName}`);
      return map.size;
    }
    return Object.fromEntries(TABLE_NAMES.map((name) => [name, tables[name].size]));
  }

  function clear(tableName) {
    if (tableName) {
      if (!tables[tableName]) throw new Error(`Unknown table: ${tableName}`);
      tables[tableName].clear();
      return;
    }
    for (const name of TABLE_NAMES) tables[name].clear();
  }

  function snapshot() {
    return {
      tables: Object.fromEntries(
        TABLE_NAMES.map((name) => [
          name,
          {
            count: tables[name].size,
            primaryKey: TABLE_SCHEMAS[name].primaryKey,
            rows: [...tables[name].values()].map((r) => ({ ...r }))
          }
        ])
      ),
      runs: runs.slice(0, 50),
      capturedAt: now()
    };
  }

  function recordRun(entry) {
    runs.unshift({
      id: `sync_${Date.now().toString(36)}`,
      at: now(),
      ...entry
    });
    if (runs.length > 100) runs.length = 100;
    return runs[0];
  }

  function listRuns({ limit = 20 } = {}) {
    return runs.slice(0, limit).map((r) => ({ ...r }));
  }

  async function persist() {
    if (!persistPath) return { persisted: false, reason: 'no_persist_path' };
    await mkdir(path.dirname(persistPath), { recursive: true });
    const payload = {
      version: 1,
      savedAt: now(),
      tables: Object.fromEntries(
        TABLE_NAMES.map((name) => [name, [...tables[name].values()].map((r) => ({ ...r }))])
      ),
      runs: runs.slice(0, 50)
    };
    await writeFile(persistPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return { persisted: true, path: persistPath, counts: count() };
  }

  async function loadPersisted() {
    if (!persistPath) return { loaded: false, reason: 'no_persist_path' };
    try {
      const raw = await readFile(persistPath, 'utf8');
      const payload = JSON.parse(raw);
      clear();
      for (const name of TABLE_NAMES) {
        const rows = payload.tables?.[name] ?? [];
        for (const row of rows) {
          try {
            upsert(name, row, { source: row._source ?? 'persist' });
          } catch {
            // skip corrupt rows
          }
        }
      }
      if (Array.isArray(payload.runs)) {
        runs.length = 0;
        runs.push(...payload.runs.slice(0, 100));
      }
      return { loaded: true, path: persistPath, counts: count() };
    } catch (error) {
      if (error && error.code === 'ENOENT') return { loaded: false, reason: 'missing' };
      return { loaded: false, reason: error.message };
    }
  }

  return {
    upsert,
    upsertMany,
    get,
    list,
    count,
    clear,
    snapshot,
    recordRun,
    listRuns,
    persist,
    loadPersisted,
    persistPath
  };
}
