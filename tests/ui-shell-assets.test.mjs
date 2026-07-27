import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'packages', 'ui-system', 'public');

const CRITICAL = [
  'theme.css',
  'shell.css',
  'components.css',
  'shell.js',
  'brand/marks/monogram.svg',
  'brand/logos/wordmark-horizontal.svg',
  'brand/icons/favicon.svg',
  'brand/seals/ledger-seal.svg',
  'brand/stamps/approved.svg',
  'brand/watermarks/ledger-watermark.svg',
  'brand/social/og-default.svg',
  'brand/documents/invoice-header.svg',
  'patterns/ledger-grid.svg',
  'patterns/subtle-brand-pattern.svg',
  'patterns/secure-document-pattern.svg',
  'illustrations/secure-login.svg',
  'illustrations/access-denied.svg',
  'illustrations/empty-search.svg',
  'illustrations/empty-clients.svg',
  'illustrations/empty-documents.svg',
  'illustrations/empty-invoices.svg',
  'illustrations/empty-payments.svg',
  'illustrations/empty-tasks.svg',
  'illustrations/payment-success.svg',
  'illustrations/approval-complete.svg',
  'illustrations/document-upload.svg',
  'illustrations/service-unavailable.svg'
];

test('critical brand and illustration assets exist under packages/ui-system/public', () => {
  for (const rel of CRITICAL) {
    const absolute = path.join(pub, rel);
    assert.ok(existsSync(absolute), `missing asset: ${rel}`);
  }
});

test('Ross AI static brand copies exist for /static serving', () => {
  const ross = path.join(root, 'ross_ai', 'web', 'static');
  for (const rel of [
    'favicon.svg',
    'og-default.svg',
    'app.css',
    'brand/marks/monogram.svg',
    'brand/logos/wordmark-horizontal.svg',
    'brand/icons/favicon.svg'
  ]) {
    assert.ok(existsSync(path.join(ross, rel)), `missing Ross AI static: ${rel}`);
  }
});
