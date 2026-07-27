// @rtp/rtp-datastore — dependency-free persistent "DB instances" for RTPSC.
//
// The platform is intentionally dependency-free (Node built-ins only). This
// package provides a lightweight, file-backed document store so services can
// persist state across restarts without pulling in Postgres/Redis/an ORM.
//
// Concepts:
//   - A **database instance** is a named store (e.g. "portal") that owns one or
//     more collections. Instances are registered in a process-level registry so
//     multiple call sites can share the same named instance.
//   - A **collection** is an append-friendly array of JSON documents persisted
//     atomically to `<dir>/<database>/<collection>.json`.
//
// Storage is JSON-on-disk with atomic writes (tmp file + rename). For tests,
// pass `persist: false` to keep everything in-memory.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_DIR = path.resolve(process.cwd(), 'logs', 'db');

/** Process-level registry of named database instances (the "DB instances"). */
const registry = new Map();

function nowIso() {
  return new Date().toISOString();
}

function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function atomicWriteJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJsonArray(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function matchesQuery(doc, query) {
  if (typeof query === 'function') return Boolean(query(doc));
  if (!query || typeof query !== 'object') return true;
  return Object.entries(query).every(([key, expected]) => doc[key] === expected);
}

/**
 * Create (or return the existing) collection API bound to a database instance.
 */
function createCollection({ dbName, name, dir, persist, now, idFactory }) {
  const filePath = path.join(dir, dbName, `${name}.json`);
  const idPrefix = name.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || 'doc';
  const docs = persist ? readJsonArray(filePath) : [];

  function flush() {
    if (persist) atomicWriteJson(filePath, docs);
  }

  function clone(doc) {
    return doc ? JSON.parse(JSON.stringify(doc)) : doc;
  }

  return Object.freeze({
    name,
    filePath: persist ? filePath : null,

    insert(input = {}) {
      const timestamp = now();
      const doc = {
        id: input.id ?? (idFactory ? idFactory(idPrefix) : defaultId(idPrefix)),
        ...input,
        createdAt: input.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      docs.push(doc);
      flush();
      return clone(doc);
    },

    getById(id) {
      return clone(docs.find((doc) => doc.id === id) ?? null);
    },

    findOne(query) {
      return clone(docs.find((doc) => matchesQuery(doc, query)) ?? null);
    },

    find(query) {
      return docs.filter((doc) => matchesQuery(doc, query)).map(clone);
    },

    all() {
      return docs.map(clone);
    },

    count(query) {
      if (query === undefined) return docs.length;
      return docs.filter((doc) => matchesQuery(doc, query)).length;
    },

    update(id, patch = {}) {
      const index = docs.findIndex((doc) => doc.id === id);
      if (index < 0) return null;
      const next = { ...docs[index], ...patch, id, updatedAt: now() };
      docs[index] = next;
      flush();
      return clone(next);
    },

    remove(id) {
      const index = docs.findIndex((doc) => doc.id === id);
      if (index < 0) return false;
      docs.splice(index, 1);
      flush();
      return true;
    },

    clear() {
      docs.length = 0;
      flush();
    }
  });
}

/**
 * Create a database instance. Instances are cached in a process-level registry
 * keyed by name so repeated calls return the same instance.
 *
 * @param {object} options
 * @param {string} options.name          Instance name (e.g. "portal").
 * @param {string} [options.dir]         Root directory for on-disk storage.
 * @param {boolean} [options.persist]    Persist to disk (default true).
 * @param {Function} [options.now]       Timestamp factory.
 * @param {Function} [options.idFactory] Id factory `(prefix) => string`.
 */
export function createDatabase({
  name,
  dir = DEFAULT_DIR,
  persist = true,
  now = nowIso,
  idFactory
} = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('createDatabase requires a string "name".');
  }
  const cacheKey = `${name}::${persist ? dir : 'memory'}`;
  if (registry.has(cacheKey)) return registry.get(cacheKey);

  if (persist) ensureDir(path.join(dir, name));
  const collections = new Map();

  const instance = Object.freeze({
    name,
    dir: persist ? path.join(dir, name) : null,
    persist,

    collection(collectionName) {
      if (!collectionName || typeof collectionName !== 'string') {
        throw new Error('collection() requires a string name.');
      }
      if (!collections.has(collectionName)) {
        collections.set(
          collectionName,
          createCollection({ dbName: name, name: collectionName, dir, persist, now, idFactory })
        );
      }
      return collections.get(collectionName);
    },

    collectionNames() {
      return [...collections.keys()];
    },

    /** JSON-safe description of the instance (no document contents). */
    describe() {
      return {
        name,
        persist,
        dir: persist ? path.join(dir, name) : null,
        collections: [...collections.entries()].map(([collectionName, collection]) => ({
          name: collectionName,
          count: collection.count()
        }))
      };
    }
  });

  registry.set(cacheKey, instance);
  return instance;
}

/** Return a previously created instance by name, or null. */
export function getDatabase(name, { dir = DEFAULT_DIR, persist = true } = {}) {
  const cacheKey = `${name}::${persist ? dir : 'memory'}`;
  return registry.get(cacheKey) ?? null;
}

/** List all registered database instances (the "DB instances"). */
export function listDatabases() {
  return [...registry.values()].map((instance) => instance.describe());
}

/** Test/utility helper: drop all registered instances from the registry. */
export function resetRegistry() {
  registry.clear();
}

export const DATASTORE_DEFAULT_DIR = DEFAULT_DIR;
