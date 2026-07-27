import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS_TAXONOMY,
  NAVIGATION,
  ROLES,
  resolveSharedPath,
  descriptor,
  navigationForRole,
  PLATFORM_BRAND,
  UI_SYSTEM_PUBLIC
} from '../packages/ui-system/src/index.mjs';

test('STATUS_TAXONOMY exposes expected groups', () => {
  assert.deepEqual(Object.keys(STATUS_TAXONOMY).sort(), [
    'approval',
    'document',
    'general',
    'payment',
    'security',
    'tax_return'
  ]);
  assert.ok(STATUS_TAXONOMY.general.includes('draft'));
  assert.ok(STATUS_TAXONOMY.payment.includes('paid'));
  assert.ok(STATUS_TAXONOMY.tax_return.includes('transmitted'));
  assert.ok(STATUS_TAXONOMY.security.includes('locked'));
});

test('NAVIGATION has only sensible section structure', () => {
  assert.ok(NAVIGATION.length >= 6);
  for (const section of NAVIGATION) {
    assert.equal(typeof section.id, 'string');
    assert.equal(typeof section.label, 'string');
    assert.ok(Array.isArray(section.items));
    assert.ok(section.items.length > 0, `section ${section.id} should have items`);
    for (const item of section.items) {
      assert.equal(typeof item.id, 'string');
      assert.equal(typeof item.label, 'string');
      assert.equal(typeof item.implemented, 'boolean');
      if (item.implemented && item.href) {
        assert.equal(typeof item.href, 'string');
      }
    }
  }
  const ids = NAVIGATION.map((s) => s.id);
  assert.ok(ids.includes('overview'));
  assert.ok(ids.includes('tax_operations'));
  assert.ok(ids.includes('administration'));
  assert.ok(ids.includes('platform'));
});

test('resolveSharedPath works for theme.css', () => {
  const absolute = resolveSharedPath('/shared/theme.css');
  assert.ok(absolute);
  assert.ok(absolute.endsWith('theme.css'));
  assert.ok(absolute.startsWith(UI_SYSTEM_PUBLIC));
  assert.equal(resolveSharedPath('/not-shared/theme.css'), null);
  assert.equal(resolveSharedPath('/shared/../theme.css'), null);
  assert.equal(resolveSharedPath('/shared/nope-missing.css'), null);
});

test('descriptor() works', () => {
  const d = descriptor();
  assert.equal(d.name, 'ui-system');
  assert.equal(d.brand.shortName, 'RTPSC');
  assert.ok(d.roles.includes('platform_administrator'));
  assert.ok(d.roles.includes('client'));
  assert.ok(d.statusGroups.includes('payment'));
  assert.ok(d.navigationSections >= 6);
  assert.ok(d.layouts.includes('AppShell'));
  assert.equal(d.brand.faviconPath, PLATFORM_BRAND.faviconPath);
});

test("navigationForRole('client') is restricted", () => {
  const nav = navigationForRole('client');
  const ids = nav.flatMap((s) => s.items.map((i) => i.id));
  assert.ok(ids.every((id) => ['documents', 'invoices', 'payments', 'help', 'dashboard'].includes(id)));
  assert.ok(!ids.includes('pos'));
  assert.ok(!ids.includes('ai_workforce'));
  assert.ok(!ids.includes('staff'));
  assert.ok(ROLES.includes('client'));
});

test("navigationForRole('read_only_auditor') excludes workforce and POS", () => {
  const ids = navigationForRole('read_only_auditor').flatMap((s) => s.items.map((i) => i.id));
  assert.ok(!ids.includes('ai_workforce'));
  assert.ok(!ids.includes('pos'));
});
