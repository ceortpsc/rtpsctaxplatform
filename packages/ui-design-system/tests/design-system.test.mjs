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
  for (const file of ['theme.css', 'components.css', 'shell.css', 'shell.js', 'brand/brand.css']) {
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

test('designSystemStylesheets returns rtp-design paths including brand kit', () => {
  const sheets = designSystemStylesheets();
  assert.ok(sheets.every((s) => s.startsWith('/rtp-design/')));
  assert.ok(sheets.includes('/rtp-design/brand/brand.css'));
});

test('brand assets present', () => {
  assert.ok(fs.existsSync(path.join(pkgRoot, 'public/brand/logos/monogram.svg')));
  assert.ok(fs.existsSync(path.join(pkgRoot, 'public/brand/logos/monogram.png')));
  assert.ok(fs.existsSync(path.join(pkgRoot, 'public/brand/logos/monogram.ico')));
  assert.ok(fs.existsSync(path.join(pkgRoot, 'public/brand/logos/lockup-stacked.svg')));
  assert.ok(fs.existsSync(path.join(pkgRoot, 'public/brand/logos/rtpsc-wordmark.png')));
  const mono = fs.readFileSync(path.join(pkgRoot, 'public/brand/logos/monogram.svg'), 'utf8');
  assert.match(mono, /signal monogram|rising signal|circle cx="48"/i);
  assert.doesNotMatch(mono, />RTP</); // advanced past generic text tile
  assert.ok(fs.existsSync(path.join(pkgRoot, 'public/illustrations/empty-invoices.svg')));
});

test('Signal Era theme tokens replace Sovereign Ledger cream/gold', () => {
  const theme = fs.readFileSync(path.join(DESIGN_SYSTEM_PUBLIC, 'theme.css'), 'utf8');
  assert.match(theme, /Signal Era/);
  assert.match(theme, /--signal-500:\s*#0a7ea4/);
  assert.match(theme, /--mist-200:\s*#e4ecf4/);
  assert.match(theme, /Syne/);
  assert.doesNotMatch(theme, /#f1e8d2/);
  assert.doesNotMatch(theme, /#b8860b/);
  assert.doesNotMatch(theme, /Iowan Old Style/);
});

test('Signal Era emblem and orbit motif exist', () => {
  const emblem = fs.readFileSync(path.join(pkgRoot, 'public/assets/emblem.svg'), 'utf8');
  assert.match(emblem, /Signal Era|signal/i);
  assert.match(emblem, /#0a7ea4|#1a9bc7/);
});

test('illustrations use Signal Era mist/signal (not cream/gold)', () => {
  for (const file of ['empty-invoices.svg', 'access-denied.svg']) {
    const svg = fs.readFileSync(path.join(pkgRoot, 'public/illustrations', file), 'utf8');
    assert.doesNotMatch(svg, /#f8f2e2|#f1e8d2|#b8860b|#d4af37/i);
    assert.match(svg, /#eef3f8|#0a7ea4|#0b1220/);
  }
});
