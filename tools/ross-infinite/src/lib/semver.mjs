/**
 * Minimal deterministic semver compare + range matcher for the prototype.
 * Supports exact versions, ^, ~, >=, >, <=, <, and * / x wildcards.
 */

function parsePart(part) {
  const match = String(part).trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] || null
  };
}

export function parseSemver(version) {
  const parsed = parsePart(version);
  if (!parsed) throw new Error(`Invalid semver: ${version}`);
  return parsed;
}

function cmpIdent(a, b) {
  const an = /^\d+$/.test(a);
  const bn = /^\d+$/.test(b);
  if (an && bn) return Number(a) - Number(b);
  if (an) return -1;
  if (bn) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareSemver(a, b) {
  const left = typeof a === 'string' ? parseSemver(a) : a;
  const right = typeof b === 'string' ? parseSemver(b) : b;
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;
  const len = Math.max(left.prerelease.length, right.prerelease.length);
  for (let i = 0; i < len; i += 1) {
    if (left.prerelease[i] === undefined) return -1;
    if (right.prerelease[i] === undefined) return 1;
    const c = cmpIdent(left.prerelease[i], right.prerelease[i]);
    if (c !== 0) return c;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const raw = comparator.trim();
  if (!raw || raw === '*' || raw === 'x' || raw === 'X') return true;

  let op = '=';
  let range = raw;
  const opMatch = raw.match(/^(>=|<=|>|<|=|\^|~)\s*(.+)$/);
  if (opMatch) {
    op = opMatch[1];
    range = opMatch[2];
  }

  const target = parseSemver(range.includes('.') ? range : `${range}.0.0`);
  const current = parseSemver(version);
  const cmp = compareSemver(current, target);

  switch (op) {
    case '=':
      return cmp === 0;
    case '>':
      return cmp > 0;
    case '>=':
      return cmp >= 0;
    case '<':
      return cmp < 0;
    case '<=':
      return cmp <= 0;
    case '^':
      if (target.major === 0) {
        if (target.minor === 0) return cmp === 0;
        return current.major === 0 && current.minor === target.minor && cmp >= 0;
      }
      return current.major === target.major && cmp >= 0;
    case '~':
      return current.major === target.major && current.minor === target.minor && cmp >= 0;
    default:
      return false;
  }
}

export function satisfies(version, range) {
  const clauses = String(range)
    .split('||')
    .map((part) => part.trim())
    .filter(Boolean);
  if (clauses.length === 0) return true;
  return clauses.some((clause) =>
    clause
      .split(/\s+/)
      .filter(Boolean)
      .every((token) => satisfiesComparator(version, token))
  );
}

export function maxSatisfying(versions, range) {
  const matched = versions.filter((v) => {
    try {
      return satisfies(v, range);
    } catch {
      return false;
    }
  });
  if (matched.length === 0) return null;
  return matched.sort(compareSemver).at(-1);
}
