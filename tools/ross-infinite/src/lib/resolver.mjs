import { maxSatisfying, compareSemver } from './semver.mjs';
import { stableStringify } from './canonical.mjs';
import { sha256, digestUri } from './hash.mjs';

/**
 * Deterministic dependency resolver.
 * packages: { name: { versions: { '1.0.0': { dependencies?: Record<string,string> } } } }
 * requests: { name: range }
 */
export function resolveDependencies(packages, requests, { rootName = 'root', rootVersion = '0.0.0' } = {}) {
  const locked = new Map();
  const queue = Object.entries(requests).map(([name, range]) => ({ name, range, parent: rootName }));
  const edges = [];

  while (queue.length > 0) {
    const { name, range, parent } = queue.shift();
    const catalog = packages[name];
    if (!catalog) {
      throw new Error(`Package not found: ${name} (required by ${parent})`);
    }
    const versions = Object.keys(catalog.versions || {}).sort(compareSemver);
    const chosen = maxSatisfying(versions, range);
    if (!chosen) {
      throw new Error(`No version of ${name} satisfies ${range} (required by ${parent})`);
    }

    edges.push({ from: parent, to: `${name}@${chosen}`, range });

    if (locked.has(name)) {
      const existing = locked.get(name);
      if (existing.version !== chosen) {
        // Prefer higher version when ranges conflict in this simplified model.
        if (compareSemver(chosen, existing.version) > 0) {
          locked.set(name, {
            version: chosen,
            dependencies: catalog.versions[chosen].dependencies || {}
          });
          for (const [dep, depRange] of Object.entries(catalog.versions[chosen].dependencies || {})) {
            queue.push({ name: dep, range: depRange, parent: `${name}@${chosen}` });
          }
        }
      }
      continue;
    }

    locked.set(name, {
      version: chosen,
      dependencies: catalog.versions[chosen].dependencies || {}
    });
    for (const [dep, depRange] of Object.entries(catalog.versions[chosen].dependencies || {})) {
      queue.push({ name: dep, range: depRange, parent: `${name}@${chosen}` });
    }
  }

  const packagesLocked = {};
  for (const name of [...locked.keys()].sort()) {
    const entry = locked.get(name);
    packagesLocked[name] = {
      version: entry.version,
      dependencies: Object.fromEntries(Object.entries(entry.dependencies).sort(([a], [b]) => a.localeCompare(b)))
    };
  }

  const lockfile = {
    lockfileVersion: 1,
    name: rootName,
    version: rootVersion,
    packages: packagesLocked,
    edges
  };
  const body = stableStringify(lockfile);
  const digest = digestUri(sha256(body));
  return { lockfile, digest, body };
}
