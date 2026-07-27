import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPartyIdentityIssuer,
  describePartyIdentity,
  parseNumber,
  formatNumber
} from '../packages/party-identity/src/index.mjs';
import { createCrmStore } from '../packages/crm-core/src/index.mjs';

test('party identity formats and parses Client/Customer ID #', () => {
  assert.equal(formatNumber('client', 1), 'CL-000001');
  assert.equal(formatNumber('customer', 42), 'CU-000042');
  assert.deepEqual(parseNumber('cl-000007'), { kind: 'client', seq: 7, number: 'CL-000007' });
  assert.equal(parseNumber('bad'), null);
});

test('issuer allocates sequential Client ID # and Customer ID #', async () => {
  const issuer = createPartyIdentityIssuer({ persist: false });
  const client = await issuer.issueClientIdNumber({ name: 'Jordan Ellis', taxpayerRef: 'TP-77' });
  const customer = await issuer.issueCustomerIdNumber({
    name: 'Jordan Ellis',
    taxpayerRef: 'TP-77',
    pairedWith: client.record.number
  });
  assert.equal(client.record.number, 'CL-000001');
  assert.equal(customer.record.number, 'CU-000001');
  assert.equal(client.label, 'Client ID #');
  assert.equal(customer.label, 'Customer ID #');
  assert.equal(issuer.get('CL-000001').name, 'Jordan Ellis');
  assert.equal(issuer.status().next.client, 'CL-000002');
});

test('issuePair links Client ID # and Customer ID #', async () => {
  const issuer = createPartyIdentityIssuer({ persist: false });
  const pair = await issuer.issuePair({ name: 'Alex Rivera', taxpayerRef: 'TP-88' });
  assert.equal(pair.clientIdNumber, 'CL-000001');
  assert.equal(pair.customerIdNumber, 'CU-000001');
  assert.equal(pair.client.pairedWith, 'CU-000001');
  assert.equal(pair.customer.pairedWith, 'CL-000001');
});

test('CRM stores and finds contacts by Client/Customer ID #', () => {
  const crm = createCrmStore();
  const contact = crm.createContact({
    name: 'Casey Nguyen',
    clientNumber: 'CL-000099',
    customerNumber: 'CU-000099',
    taxpayerRef: 'TP-101'
  });
  assert.equal(contact.clientNumber, 'CL-000099');
  assert.equal(crm.findByClientNumber('CL-000099').id, contact.id);
  assert.equal(crm.findByCustomerNumber('cu-000099').name, 'Casey Nguyen');
  assert.ok(crm.searchContacts('CL-000099').length >= 1);
});

test('describePartyIdentity documents issuance role', () => {
  const desc = describePartyIdentity();
  assert.equal(desc.name, '@rtp/party-identity');
  assert.deepEqual(desc.kinds, ['client', 'customer']);
  assert.match(desc.examples.client, /^CL-/);
});
