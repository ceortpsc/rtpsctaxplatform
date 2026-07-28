// Parse ("phrase"), validate, and verify an IRS e-file Application Summary PDF.
//
// The Application Summary is the document an Authorized e-file Provider prints
// from IRS e-Services; it lists the firm, EFIN, provider options, and EFIN status.
// This scaffold extracts text (see ./pdf.mjs), pulls the key fields, and verifies
// them against the EFIN the operator entered. It does NOT contact the IRS.

import { extractPdfText } from './pdf.mjs';

const SUMMARY_MARKERS = [
  /application\s+summary/i,
  /e-?file\s+application/i,
  /provider\s+options?/i,
  /efin\s+status/i,
  /tracking\s+number/i
];

const PROVIDER_OPTION_PHRASES = [
  { key: 'ero', re: /electronic\s+return\s+originator|\bERO\b/i },
  { key: 'transmitter', re: /transmitter/i },
  { key: 'software-developer', re: /software\s+developer/i },
  { key: 'reporting-agent', re: /reporting\s+agent/i },
  { key: 'intermediate-service-provider', re: /intermediate\s+service\s+provider/i }
];

const ACTIVE_STATUS_RE = /^(active|complete|completed)$/i;

function textFrom(input) {
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) return extractPdfText(input);
  return String(input ?? '');
}

function maskEfin(efin) {
  const n = String(efin ?? '').replace(/\D/g, '');
  return /^\d{6}$/.test(n) ? `${n.slice(0, 2)}••${n.slice(-2)}` : null;
}

/** Parse ("phrase") key fields out of the Application Summary text. */
export function parseApplicationSummary(input) {
  const text = textFrom(input);
  const compact = text.replace(/\s+/g, ' ').trim();

  const efinMatch = compact.match(/EFIN[^0-9]{0,40}(\d{6})/i);
  const etinMatch = compact.match(/ETIN[^0-9]{0,40}(\d{5})/i);
  const statusMatch =
    compact.match(/EFIN\s*Status[:\s]*([A-Za-z]+)/i) ||
    compact.match(/\bStatus[:\s]*([A-Za-z]+)/i);
  const firmMatch = compact.match(
    /(?:Firm\s*Name|Business\s*Name|Doing\s*Business\s*As|DBA)\s*[:\-]?\s*([A-Za-z0-9&.,'\- ]{2,80}?)(?:\s{2,}|\bEFIN\b|\bETIN\b|\bAddress\b|\bProvider\b|$)/i
  );

  const providerOptions = PROVIDER_OPTION_PHRASES.filter((option) => option.re.test(compact)).map(
    (option) => option.key
  );

  return {
    isApplicationSummary: SUMMARY_MARKERS.some((re) => re.test(compact)),
    efin: efinMatch ? efinMatch[1] : null,
    efinMasked: efinMatch ? maskEfin(efinMatch[1]) : null,
    etin: etinMatch ? etinMatch[1] : null,
    status: statusMatch ? statusMatch[1] : null,
    firmName: firmMatch ? firmMatch[1].trim() : null,
    providerOptions
  };
}

/** Validate that the document is a usable Application Summary. */
export function validateApplicationSummary(input) {
  const fields = parseApplicationSummary(input);
  const reasons = [];
  if (!fields.isApplicationSummary) reasons.push('Document does not look like an e-file Application Summary.');
  if (!fields.efin) reasons.push('No EFIN could be read from the document.');
  return { ok: reasons.length === 0, reasons, fields };
}

/**
 * Verify the Application Summary against the operator's entered details.
 * Hard checks: is-summary, efin-present, efin-match. Status is a soft check.
 * @returns {{ verified, ok, checks, fields, textLength }}
 */
export function verifyApplicationSummary(input, { expectedEfin, expectedFirmName } = {}) {
  const text = textFrom(input);
  const fields = parseApplicationSummary(text);
  const checks = [];
  const add = (id, label, ok, detail, required = true) =>
    checks.push({ id, label, ok: Boolean(ok), detail: detail ?? null, required });

  add('is_summary', 'Document is an e-file Application Summary', fields.isApplicationSummary);
  add('efin_present', 'Summary contains a readable EFIN', Boolean(fields.efin), fields.efinMasked);

  const normalizedExpected = String(expectedEfin ?? '').replace(/\D/g, '');
  if (normalizedExpected) {
    add(
      'efin_match',
      'Summary EFIN matches the entered EFIN',
      fields.efin === normalizedExpected,
      fields.efin ? `${fields.efinMasked} vs entered ${maskEfin(normalizedExpected)}` : 'no EFIN in summary'
    );
  }

  // Soft checks (do not block verification).
  add('status_active', 'EFIN status is Active/Complete', ACTIVE_STATUS_RE.test(fields.status ?? ''), fields.status ?? 'unknown', false);
  if (expectedFirmName) {
    const a = String(expectedFirmName).trim().toLowerCase();
    const b = String(fields.firmName ?? '').trim().toLowerCase();
    add('firm_match', 'Firm name resembles the entered firm', Boolean(b) && (a.includes(b) || b.includes(a)), fields.firmName ?? 'not found', false);
  }

  const verified = checks.filter((c) => c.required).every((c) => c.ok);
  return { verified, ok: verified, checks, fields, textLength: text.length };
}

/** Analyze without an expected EFIN (parse + validate). */
export function analyzeApplicationSummary(input) {
  const validation = validateApplicationSummary(input);
  return { ...validation, textLength: textFrom(input).length };
}

export const __summaryTesting = { maskEfin, SUMMARY_MARKERS };
