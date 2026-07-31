/** Evidence progression for SEO ownership control plane. */
export const EVIDENCE_STATES = Object.freeze([
  'ASSERTED',
  'PREVALIDATED',
  'DEPLOYED',
  'PROVIDER_VERIFIED',
  'INDEXING_ENABLED',
  'INDEXED'
]);

export function stateIndex(state) {
  return EVIDENCE_STATES.indexOf(state);
}

export function summarizeState(current) {
  const idx = stateIndex(current);
  return {
    current: current ?? null,
    known: idx >= 0,
    remaining: idx >= 0 ? EVIDENCE_STATES.slice(idx + 1) : [...EVIDENCE_STATES],
    pipeline: [...EVIDENCE_STATES]
  };
}
