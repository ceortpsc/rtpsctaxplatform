/**
 * Full Report Export CSV parser for SBTPG federal returns.
 * Handles known column-shift in Preparer Name→… fields from live exports
 * (one missing cell left-shifts values under earlier headers).
 */

import { readFile } from 'node:fs/promises';

function stripExcel(value) {
  if (value == null) return '';
  let s = String(value).trim();
  if (s.startsWith('="') && s.endsWith('"')) s = s.slice(2, -1);
  s = s.replace(/^="+|"+$/g, '');
  return s.trim();
}

function parseMoney(value) {
  const s = stripExcel(value).replace(/[$,\s]/g, '');
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  const s = stripExcel(value);
  if (!s) return null;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split('/').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function isAckCode(value) {
  return /^[ARCPO]$/i.test(stripExcel(value));
}

function isPtin(value) {
  return /^P\d{8}$/i.test(stripExcel(value));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stripExcel(value));
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQuotes = !inQuotes;
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

/** Live exports often drop Preparer Name, left-shifting PTIN into that column. */
function detectShift(cells, header) {
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const preparerName = cells[idx['Preparer Name']] ?? '';
  const ackDate = cells[idx['Ack Date']] ?? '';
  return isPtin(preparerName) || isAckCode(ackDate);
}

function cell(cells, header, name, shifted) {
  const i = header.indexOf(name);
  if (i < 0) return '';
  const pivot = header.indexOf('Preparer Name');
  // Values sit one column earlier than their headers from Preparer Name onward.
  const at = shifted && pivot >= 0 && i >= pivot ? i - 1 : i;
  if (at < 0) return '';
  return cells[at] ?? '';
}

/** Normalize one Full Report Export row into a federal return ledger record. */
export function normalizeFederalReturnRow(cells, header, options = {}) {
  const shifted = options.forceShift ?? detectShift(cells, header);
  const get = (name) => stripExcel(cell(cells, header, name, shifted));

  const returnIdRaw = get('ReturnID');
  const ssnRaw = get('SSN');
  const returnId = isUuid(returnIdRaw) ? returnIdRaw : isUuid(ssnRaw) ? ssnRaw : returnIdRaw || null;

  const lastFourRaw = get('Last Four');
  const lastFour = (lastFourRaw.replace(/\D/g, '').slice(-4) || '').slice(-4);

  const firstName = get('First Name');
  const lastName = get('Last Name');
  const ptin = isPtin(get('PTIN')) ? get('PTIN') : isPtin(get('Preparer Name')) ? get('Preparer Name') : get('PTIN');

  const transmitDate = parseDate(get('Transmit Date'));
  const processDate = parseDate(get('Process Date'));
  const ackDate = parseDate(get('Ack Date'));
  const ackCodeRaw = get('Ack Code');
  const ackCode = isAckCode(ackCodeRaw)
    ? ackCodeRaw.toUpperCase()
    : isAckCode(get('Ack Date'))
      ? get('Ack Date').toUpperCase()
      : stripExcel(ackCodeRaw).toUpperCase() || null;
  const fundedDate = parseDate(get('Funded Date'));
  const refund = parseMoney(get('Refund'));

  const auditDesc = get('Audit Description');
  const idTheftDesc = get('ID Theft Descption') || get('Has ID Theft Product');
  const prepFee = parseMoney(get('Prep Fee'));
  const efileFee = parseMoney(get('Efile Fee'));
  const product = get('Product') || null;
  const bank = get('Bank') || get('Return Type') || null;
  const bankProduct = /SBTPG/i.test(String(bank))
    ? bank
    : /SBTPG/i.test(String(get('Return Type')))
      ? get('Return Type')
      : bank;

  return {
    groupId: get('Group Name'),
    customerId: get('customerId'),
    office: get('Dashboard Office Id'),
    companyName: get('Company Name'),
    preparer: get('Preparer'),
    ptin,
    firstName,
    lastName,
    lastFour: lastFour || null,
    returnId,
    taxpayerRef: lastFour ? `TP-${lastFour}` : `TP-${(returnId || 'UNK').toString().slice(0, 8)}`,
    clientName: [firstName, lastName].filter(Boolean).join(' ').trim() || get('Contact Name') || 'Client',
    email: get('Email Address'),
    state: get('TPState'),
    city: get('TPCity'),
    formType: get('1040Type') || '1040',
    product,
    bankProduct,
    transmitDate,
    processDate,
    ackDate,
    ackCode,
    fundedDate,
    refund,
    prepFee,
    efileFee,
    auditProduct: /audit/i.test(String(auditDesc)) ? String(auditDesc) : null,
    idTheftProduct: /securely|id.?theft/i.test(String(idTheftDesc)) ? String(idTheftDesc) : null,
    filingStatus: get('Filing Status') || null,
    agi: parseMoney(get('AGI')),
    shifted,
    source: 'full-report-export'
  };
}

/** Parse Full Report Export CSV text into normalized federal return rows. */
export function parseFullReportExport(csvText) {
  const lines = String(csvText)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length < 2) return { header: [], rows: [], count: 0 };

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !String(c).trim())) continue;
    rows.push(normalizeFederalReturnRow(cells, header));
  }
  return { header, rows, count: rows.length, source: 'full-report-export' };
}

export async function loadFullReportExportFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  return parseFullReportExport(text);
}

export { stripExcel, parseMoney, parseDate };
