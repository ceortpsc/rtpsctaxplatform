/** Canonical JSON serialization for deterministic lockfiles and digests. */

export function canonicalize(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortValue(value[key]);
    }
    return out;
  }
  return value;
}

export function stableStringify(value, space = 2) {
  return `${JSON.stringify(sortValue(value), null, space)}\n`;
}
