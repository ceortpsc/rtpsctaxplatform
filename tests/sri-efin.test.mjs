import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, resetRegistry } from '../packages/rtp-datastore/src/index.mjs';
import {
  validateEfin,
  validateEtin,
  createEfinRecord,
  canTransition,
  transitionEfinStatus,
  publicEfinRecord,
  createEfinRegistry,
  PROVIDER_TYPES,
  EFIN_STATUSES,
  __testing
} from '../packages/sri-efin/src/index.mjs';

test('EFIN validation: 6 digits, not all zeros', () => {
  assert.equal(validateEfin('123456').ok, true);
  assert.equal(validateEfin('12-34 56').ok, true, 'strips spaces/dashes');
  assert.equal(validateEfin('12345').ok, false);
  assert.equal(validateEfin('1234567').ok, false);
  assert.equal(validateEfin('abcdef').ok, false);
  assert.equal(validateEfin('000000').ok, false);
});

test('ETIN validation: optional, 5 digits', () => {
  assert.equal(validateEtin('').ok, true);
  assert.equal(validateEtin(null).ok, true);
  assert.equal(validateEtin('12345').ok, true);
  assert.equal(validateEtin('1234').ok, false);
});

test('createEfinRecord: validates and masks, defaults provider type', () => {
  const record = createEfinRecord({ efin: '123456', firmName: 'Ross Tax Pro' });
  assert.equal(record.status, 'draft');
  assert.equal(record.efinMasked, '12••56');
  assert.deepEqual(record.providerTypes, ['ero']);
  assert.throws(() => createEfinRecord({ efin: '1', firmName: 'X' }), /EFIN/);
  assert.throws(() => createEfinRecord({ efin: '123456' }), /firmName/);
  assert.throws(
    () => createEfinRecord({ efin: '123456', firmName: 'X', providerTypes: ['nope'] }),
    /provider type/
  );
});

test('status lifecycle transitions are fail-safe', () => {
  assert.equal(canTransition('draft', 'submitted'), true);
  assert.equal(canTransition('submitted', 'active'), false);
  const record = createEfinRecord({ efin: '123456', firmName: 'Ross Tax Pro' });
  const submitted = transitionEfinStatus(record, 'submitted');
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.history.length, 2);
  assert.throws(() => transitionEfinStatus(submitted, 'active'), /Cannot transition/);
  assert.throws(() => transitionEfinStatus(record, 'bogus'), /Unknown status/);
  assert.ok(PROVIDER_TYPES.includes('ero'));
  assert.ok(EFIN_STATUSES.includes('active'));
});

test('publicEfinRecord never leaks the raw EFIN', () => {
  const record = createEfinRecord({ efin: '123456', firmName: 'Ross Tax Pro' });
  const projection = publicEfinRecord(record);
  assert.equal(projection.efinMasked, '12••56');
  assert.equal(projection.efin, undefined);
  assert.equal(__testing.maskEfin('654321'), '65••21');
});

test('persistent EFIN registry: register, dedupe, list, transition', () => {
  resetRegistry();
  const db = createDatabase({ name: 'efin-test', persist: false });
  const registry = createEfinRegistry({ db });

  const created = registry.register({
    efin: '123456',
    firmName: 'Ross Tax Pro',
    providerTypes: ['ero', 'transmitter'],
    accountId: 'acct-1'
  });
  assert.equal(created.ok, true);
  assert.equal(created.provider.efinMasked, '12••56');

  const dup = registry.register({ efin: '123456', firmName: 'Other' });
  assert.equal(dup.ok, false);
  assert.equal(dup.code, 'efin_exists');

  assert.equal(registry.list({ accountId: 'acct-1' }).length, 1);
  assert.equal(registry.byEfin('123456').firmName, 'Ross Tax Pro');

  const moved = registry.transition(created.provider.id, 'submitted');
  assert.equal(moved.ok, true);
  assert.equal(moved.provider.status, 'submitted');

  const bad = registry.transition(created.provider.id, 'active');
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'invalid_transition');
});
