import http from 'node:http';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256, digestUri } from '../lib/hash.mjs';
import { stableStringify } from '../lib/canonical.mjs';

const DEFAULT_PORT = 4873;

export function createRegistry({ dataDir, service = 'ross-infinite-registry' } = {}) {
  const packages = new Map();

  async function ensure() {
    if (!dataDir) return;
    await mkdir(dataDir, { recursive: true });
    const catalogPath = path.join(dataDir, 'catalog.json');
    try {
      await access(catalogPath);
      const raw = JSON.parse(await readFile(catalogPath, 'utf8'));
      for (const [name, meta] of Object.entries(raw.packages || {})) packages.set(name, meta);
    } catch {
      await persist();
    }
  }

  async function persist() {
    if (!dataDir) return;
    const body = stableStringify({
      service,
      updatedAt: new Date().toISOString(),
      packages: Object.fromEntries([...packages.entries()].sort(([a], [b]) => a.localeCompare(b)))
    });
    await writeFile(path.join(dataDir, 'catalog.json'), body, 'utf8');
  }

  function publish(name, version, manifest = {}) {
    const current = packages.get(name) || { name, versions: {} };
    const payload = { ...manifest, name, version };
    const digest = digestUri(sha256(stableStringify(payload)));
    current.versions[version] = { ...payload, digest };
    packages.set(name, current);
    return { name, version, digest };
  }

  function getPackage(name) {
    return packages.get(name) || null;
  }

  async function handle(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service, packageCount: packages.size });
    }
    if (req.method === 'GET' && url.pathname === '/metadata') {
      return json(res, 200, {
        service,
        product: 'ROSS.CO Infinite',
        protocol: 'ross-registry-v1',
        endpoints: ['/health', '/metadata', '/-/ping', '/:package', '/-/publish']
      });
    }
    if (req.method === 'GET' && url.pathname === '/-/ping') {
      return json(res, 200, { pong: true, service });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/') && url.pathname !== '/') {
      const name = decodeURIComponent(url.pathname.slice(1));
      const found = getPackage(name);
      if (!found) return json(res, 404, { error: 'not_found', name });
      return json(res, 200, found);
    }
    if (req.method === 'POST' && url.pathname === '/-/publish') {
      const body = await readBody(req);
      let parsed;
      try {
        parsed = JSON.parse(body || '{}');
      } catch {
        return json(res, 400, { error: 'invalid_json' });
      }
      if (!parsed.name || !parsed.version) return json(res, 400, { error: 'name_and_version_required' });
      const published = publish(parsed.name, parsed.version, parsed);
      await persist();
      return json(res, 201, published);
    }
    return json(res, 404, { error: 'not_found' });
  }

  async function listen(port = DEFAULT_PORT) {
    await ensure();
    const server = http.createServer((req, res) => {
      handle(req, res).catch((error) => json(res, 500, { error: error.message }));
    });
    await new Promise((resolve) => server.listen(port, resolve));
    return server;
  }

  return { ensure, persist, publish, getPackage, handle, listen, packages };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const dataDir = process.env.ROSS_REGISTRY_DATA || path.join(process.cwd(), '.ross', 'registry');
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const registry = createRegistry({ dataDir });
  const server = await registry.listen(port);
  console.log(JSON.stringify({ service: 'ross-infinite-registry', port, dataDir }, null, 2));
  // Keep process alive for smoke / docker
  await new Promise(() => {});
  server.close();
}
