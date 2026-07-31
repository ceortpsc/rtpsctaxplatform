import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, getDatabase, listDatabases, resetRegistry } from '../packages/rtp-datastore/src/index.mjs';

test('datastore: insert/get/find/update/remove on an in-memory instance', () => {
  resetRegistry();
  const db = createDatabase({ name: 'test-basic', persist: false });
  const accounts = db.collection('accounts');

  const a = accounts.insert({ email: 'a@example.com', name: 'A' });
  assert.ok(a.id.startsWith('accoun'));
  assert.ok(a.createdAt && a.updatedAt);
  assert.equal(accounts.count(), 1);

  assert.equal(accounts.getById(a.id).email, 'a@example.com');
  assert.equal(accounts.findOne({ email: 'a@example.com' }).id, a.id);
  assert.equal(accounts.find((doc) => doc.name === 'A').length, 1);

  const updated = accounts.update(a.id, { name: 'AA' });
  assert.equal(updated.name, 'AA');
  assert.equal(accounts.getById(a.id).name, 'AA');

  assert.equal(accounts.remove(a.id), true);
  assert.equal(accounts.count(), 0);
});

test('datastore: returns clones (no external mutation of stored docs)', () => {
  resetRegistry();
  const db = createDatabase({ name: 'test-clone', persist: false });
  const c = db.collection('items');
  const doc = c.insert({ nested: { value: 1 } });
  doc.nested.value = 999;
  assert.equal(c.getById(doc.id).nested.value, 1);
});

test('datastore: named instances are registered and shared', () => {
  resetRegistry();
  const first = createDatabase({ name: 'portal-x', persist: false });
  const again = createDatabase({ name: 'portal-x', persist: false });
  assert.equal(first, again, 'same name returns the same instance');
  assert.equal(getDatabase('portal-x', { persist: false }), first);

  first.collection('accounts').insert({ email: 'z@example.com' });
  const described = listDatabases().find((d) => d.name === 'portal-x');
  assert.ok(described);
  assert.equal(described.collections.find((c) => c.name === 'accounts').count, 1);
});

test('datastore: persists to disk and reloads across instances', () => {
  resetRegistry();
  const dir = `/tmp/rtp-datastore-test-${Date.now()}`;
  const db = createDatabase({ name: 'persisted', dir });
  const rec = db.collection('things').insert({ label: 'keep-me' });

  resetRegistry(); // simulate a fresh process
  const reopened = createDatabase({ name: 'persisted', dir });
  assert.equal(reopened.collection('things').getById(rec.id).label, 'keep-me');
});
