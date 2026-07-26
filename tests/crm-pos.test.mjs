import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrmStore } from '../packages/crm-core/src/index.mjs';
import { createPosStore } from '../packages/pos-core/src/index.mjs';
import {
  createSbtpgTraceStore,
  phraseForEro,
  scoreRefundIntelligence,
  listPhraseTemplates
} from '../packages/ero-ops/src/index.mjs';

test('CRM creates contacts linked to household accounts', () => {
  const crm = createCrmStore();
  const contact = crm.createContact({
    name: 'Jordan Ellis',
    email: 'jordan@example.com',
    taxpayerRef: 'TP-77',
    state: 'LA',
    locality: 'ORLEANS',
    tags: ['efile']
  });
  assert.ok(contact.id.startsWith('crm_'));
  assert.ok(contact.accountId);
  assert.equal(crm.findAccount(contact.accountId).name.includes('Jordan'), true);
  assert.equal(crm.searchContacts('orleans').length, 1);
});

test('POS checkout settles through invoice-core and writes CRM interaction', () => {
  const crm = createCrmStore();
  const contact = crm.createContact({
    name: 'Jordan Ellis',
    state: 'LA',
    locality: 'ORLEANS',
    taxpayerRef: 'TP-77'
  });
  const pos = createPosStore(crm);
  let session = pos.openSession({ contactId: contact.id, register: 'REG-1', operator: 'ops' });
  session = pos.addItem(session.id, { sku: 'TAX-PREP-1040', quantity: 1 });
  session = pos.addItem(session.id, { sku: 'CONSULT-HR', quantity: 1 });
  const result = pos.checkout(session.id, { method: 'card', reference: 'AUTH-1' });
  assert.equal(result.session.status, 'closed');
  assert.equal(result.sale.status, 'paid');
  assert.ok(result.invoice.confirmation);
  assert.ok(result.exports.invoicePdf.slice(0, 5).toString() === '%PDF-');
  assert.match(result.sale.receiptText, /RECEIPT/);
  const updated = crm.findContact(contact.id);
  assert.equal(updated.lastSaleId, result.sale.id);
  assert.ok(crm.listInteractions(contact.id).some((i) => i.type === 'sale'));
});

test('SBTPG traces and ERO phrasing / refund intelligence', () => {
  assert.ok(listPhraseTemplates().length >= 4);
  const phrase = phraseForEro('REFUND-STATUS-CLIENT', {
    clientName: 'Jordan',
    taxpayerRef: 'TP-77',
    statusPhrase: 'under review'
  });
  assert.match(phrase.text, /Jordan/);
  assert.match(phrase.text, /TP-77/);

  const intel = scoreRefundIntelligence({
    hasTranscript: true,
    refundStatus: 'review',
    sbtpgEnrolled: true,
    paymentGateBlocked: true,
    posPaid: true
  });
  assert.ok(intel.score >= 0 && intel.score <= 100);
  assert.ok(['strong', 'watch', 'elevate'].includes(intel.band));

  const store = createSbtpgTraceStore();
  const trace = store.trackReport({
    productCode: 'RA-NF',
    stage: 'received',
    taxpayerRef: 'TP-77',
    detail: 'Initial report'
  });
  assert.equal(trace.provider, 'SBTPG');
  const next = store.appendEvent(trace.id, { stage: 'underwriting', detail: 'Docs requested' });
  assert.equal(next.stage, 'underwriting');
  assert.equal(next.events.length, 2);
});
