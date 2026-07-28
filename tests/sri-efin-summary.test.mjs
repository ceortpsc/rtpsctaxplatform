import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { buildTextPdf } from '../packages/invoice-core/src/pdf.mjs';
import {
  extractPdfText,
  parseApplicationSummary,
  validateApplicationSummary,
  verifyApplicationSummary
} from '../packages/sri-efin/src/index.mjs';

const SUMMARY_LINES = [
  'IRS e-file Application Summary',
  'Firm Name: Chen Tax Group',
  'EFIN: 500123',
  'ETIN: 90211',
  'EFIN Status: Active',
  'Provider Options: Electronic Return Originator, Transmitter',
  'Tracking Number: 1234567890'
];

function flateSummaryPdf(lines) {
  const content = `BT /F1 10 Tf 48 720 Td ${lines
    .map((l, i) => `${i ? '0 -14 Td ' : ''}(${l}) Tj`)
    .join(' ')} ET`;
  const deflated = zlib.deflateSync(Buffer.from(content, 'latin1'));
  const head = Buffer.from(
    `%PDF-1.4\n4 0 obj\n<< /Length ${deflated.length} /Filter /FlateDecode >>\nstream\n`,
    'latin1'
  );
  const tail = Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1');
  return Buffer.concat([head, deflated, tail]);
}

test('extractPdfText reads an uncompressed (Tj) PDF', () => {
  const pdf = buildTextPdf(SUMMARY_LINES, { title: 'Application Summary' });
  const text = extractPdfText(pdf);
  assert.match(text, /Application Summary/i);
  assert.match(text, /500123/);
  assert.match(text, /Chen Tax Group/);
});

test('extractPdfText inflates a FlateDecode content stream', () => {
  const pdf = flateSummaryPdf(SUMMARY_LINES);
  const text = extractPdfText(pdf);
  assert.match(text, /e-file Application Summary/i);
  assert.match(text, /500123/);
});

test('parseApplicationSummary phrases key fields', () => {
  const pdf = buildTextPdf(SUMMARY_LINES);
  const fields = parseApplicationSummary(pdf);
  assert.equal(fields.isApplicationSummary, true);
  assert.equal(fields.efin, '500123');
  assert.equal(fields.efinMasked, '50••23');
  assert.equal(fields.etin, '90211');
  assert.match(fields.firmName, /Chen Tax Group/);
  assert.match(fields.status, /Active/i);
  assert.ok(fields.providerOptions.includes('ero'));
  assert.ok(fields.providerOptions.includes('transmitter'));
});

test('validateApplicationSummary rejects non-summary documents', () => {
  const bogus = buildTextPdf(['Just a random invoice', 'Total: $250.00']);
  const result = validateApplicationSummary(bogus);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.length >= 1);
});

test('verifyApplicationSummary passes when the EFIN matches and fails otherwise', () => {
  const pdf = buildTextPdf(SUMMARY_LINES);

  const ok = verifyApplicationSummary(pdf, { expectedEfin: '500123', expectedFirmName: 'Chen Tax Group' });
  assert.equal(ok.verified, true);
  assert.ok(ok.checks.find((c) => c.id === 'efin_match').ok);
  assert.ok(ok.checks.find((c) => c.id === 'status_active').ok);
  assert.ok(ok.checks.find((c) => c.id === 'firm_match').ok);

  const mismatch = verifyApplicationSummary(pdf, { expectedEfin: '999999' });
  assert.equal(mismatch.verified, false);
  assert.equal(mismatch.checks.find((c) => c.id === 'efin_match').ok, false);
});
