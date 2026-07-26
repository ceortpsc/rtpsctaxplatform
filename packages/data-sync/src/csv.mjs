/**
 * Dependency-free CSV helpers for table synchronization.
 * Supports quoted fields, Excel-style ="value" cells, and flexible headers.
 */

function stripExcel(value) {
  if (value == null) return '';
  let s = String(value).trim();
  if (s.startsWith('="') && s.endsWith('"')) s = s.slice(2, -1);
  s = s.replace(/^="+|"+$/g, '');
  return s.trim();
}

export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Normalize a header cell into a camelCase / schema-friendly key. */
export function normalizeHeader(header) {
  const raw = stripExcel(header);
  if (!raw) return '';
  const mapped = HEADER_ALIASES[raw] ?? HEADER_ALIASES[raw.toLowerCase()];
  if (mapped) return mapped;
  return raw
    .replace(/[#./]+/g, ' ')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

const HEADER_ALIASES = Object.freeze({
  'Taxpayer Ref': 'taxpayerRef',
  taxpayer_ref: 'taxpayerRef',
  TaxpayerRef: 'taxpayerRef',
  'Case ID': 'caseId',
  case_id: 'caseId',
  CaseId: 'caseId',
  'Invoice ID': 'invoiceId',
  invoice_id: 'invoiceId',
  'Return ID': 'returnId',
  ReturnID: 'returnId',
  return_id: 'returnId',
  'Last Four': 'lastFour',
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'Ack Code': 'ackCode',
  'Transmit Date': 'transmitDate',
  'Funded Date': 'fundedDate',
  'Filing Stage': 'filingStage',
  'Client Name': 'clientName',
  Jurisdiction: 'jurisdictionKey',
  'State Rate': 'stateRate',
  'Local Rate': 'localRate',
  'Combined Rate': 'combinedRate',
  Interaction: 'interactionId',
  'Interaction ID': 'interactionId'
});

/**
 * Parse a full CSV document into { headers, rows } where rows are objects keyed by normalized headers.
 */
export function parseCsv(text) {
  const lines = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const rawHeaders = parseCsvLine(lines[0]).map(stripExcel);
  const headers = rawHeaders.map(normalizeHeader);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]).map(stripExcel);
    if (cells.every((c) => c === '')) continue;
    const row = {};
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      if (!key) continue;
      row[key] = cells[c] ?? '';
    }
    rows.push(row);
  }

  return { headers, rows, rawHeaders };
}

export function toCsv(headers, rows) {
  const escape = (value) => {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
