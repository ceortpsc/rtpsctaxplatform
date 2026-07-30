import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV_SECTIONS, flattenNavItems } from '../src/navigation.mjs';
import { filterNavByRole, roleAtLeast } from '../src/roles.mjs';
import { DESIGN_SYSTEM_PUBLIC, designSystemStylesheets } from '../src/static.mjs';

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('design system public assets exist', () => {
  for (const file of ['theme.css', 'components.css', 'shell.css', 'shell.js']) {
    assert.ok(fs.existsSync(path.join(DESIGN_SYSTEM_PUBLIC, file)), `${file} missing`);
  }
});

test('navigation sections include implemented modules', () => {
  const flat = flattenNavItems();
  const ready = flat.filter((i) => i.status === 'ready' && i.href);
  assert.ok(ready.length >= 5, 'expected multiple ready nav items');
  assert.ok(flat.some((i) => i.id === 'invoices'));
  assert.ok(flat.some((i) => i.id === 'dashboard'));
});

test('role filtering hides admin-only items from clients', () => {
  const adminItems = NAV_SECTIONS.find((s) => s.id === 'admin')?.items ?? [];
  const filtered = filterNavByRole(adminItems, 'client');
  assert.equal(filtered.length, 0);
});

test('roleAtLeast compares hierarchy', () => {
  assert.ok(roleAtLeast('platform_admin', 'tax_preparer'));
  assert.ok(!roleAtLeast('client', 'billing_specialist'));
});

test('designSystemStylesheets returns rtp-design paths', () => {
  const sheets = designSystemStylesheets();
  assert.ok(sheets.every((s) => s.startsWith('/rtp-design/')));
});

test('brand assets present', () => {
  assert.ok(fs.existsSync(path.join(pkgRoot, 'public/brand/logos/monogram.svg')));
  assert.ok(fs.existsSync(path.join(pkgRoot, 'public/illustrations/empty-invoices.svg')));
});
