import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listStates,
  listLocalities,
  resolveJurisdiction,
  calculateSalesTax,
  findLocality
} from '../packages/tax-data/src/index.mjs';

test('tax-data includes states and Louisiana parishes', () => {
  const states = listStates();
  assert.ok(states.some((s) => s.code === 'LA'));
  const la = listLocalities('LA');
  assert.ok(la.length >= 3);
  assert.ok(la.every((l) => l.kind === 'parish'));
  assert.ok(findLocality('LA', 'ORLEANS'));
});

test('resolveJurisdiction combines state + parish rates for Orleans LA', () => {
  const j = resolveJurisdiction({ state: 'LA', locality: 'ORLEANS' });
  assert.equal(j.found, true);
  assert.equal(j.state.code, 'LA');
  assert.equal(j.locality.kind, 'parish');
  assert.ok(j.combinedRate > j.state.rate);
});

test('resolveJurisdiction accepts free-text parish queries', () => {
  const j = resolveJurisdiction({ query: 'Orleans Parish Louisiana' });
  assert.equal(j.found, true);
  assert.equal(j.locality.code, 'ORLEANS');
});

test('calculateSalesTax returns rounded dollars', () => {
  const calc = calculateSalesTax(100, { state: 'TX', locality: 'HARRIS' });
  assert.equal(calc.taxableAmount, 100);
  assert.ok(calc.tax > 0);
  assert.equal(Number.isInteger(Math.round(calc.tax * 100)), true);
});
