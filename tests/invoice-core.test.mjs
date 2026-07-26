import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assistDataEntry,
  createInvoice,
  submitForApproval,
  approveInvoice,
  recordPayment,
  exportInvoicePdf,
  exportReceiptPdf,
  exportReceiptText,
  renderReceiptPaper
} from '../packages/invoice-core/src/index.mjs';

test('AI assist matches catalog services and Orleans Parish jurisdiction', () => {
  const assist = assistDataEntry({
    text: '2 hours consultation and 1040 prep for Jordan Ellis in Orleans Parish LA $400'
  });
  assert.equal(assist.engine, 'invoice-ai-assist');
  assert.ok(assist.lineItems.length >= 1);
  assert.ok(assist.lineItems.some((l) => /1040|CONSULT/i.test(l.sku + l.description)));
  assert.equal(assist.jurisdiction.state?.code, 'LA');
  assert.equal(assist.jurisdiction.locality?.code, 'ORLEANS');
  assert.ok(/Jordan/i.test(assist.client.name));
});

test('invoice lifecycle: create → approve → pay → confirmation + exports', () => {
  let inv = createInvoice({
    clientName: 'Jordan Ellis',
    email: 'jordan@example.com',
    state: 'LA',
    locality: 'ORLEANS',
    lineItems: [
      { sku: 'TAX-PREP-1040', description: 'Individual tax preparation (Form 1040)', quantity: 1, unitPrice: 250, taxable: true },
      { sku: 'CONSULT-HR', description: 'Tax consultation (per hour)', quantity: 2, unitPrice: 150, taxable: true }
    ]
  });
  assert.equal(inv.status, 'draft');
  assert.ok(inv.total > inv.subtotal);
  assert.ok(inv.tax > 0);

  inv = submitForApproval(inv);
  assert.equal(inv.status, 'pending-approval');
  inv = approveInvoice(inv, { approver: 'ops-desk' });
  assert.equal(inv.status, 'approved');

  inv = recordPayment(inv, { method: 'card', amount: inv.total, reference: 'AUTH-99' });
  assert.equal(inv.status, 'paid');
  assert.equal(inv.confirmation.status, 'confirmed');
  assert.ok(inv.confirmation.id.startsWith('cfm_'));

  const pdf = exportInvoicePdf(inv);
  assert.ok(pdf.slice(0, 5).toString() === '%PDF-');
  const receiptPdf = exportReceiptPdf(inv);
  assert.ok(receiptPdf.slice(0, 5).toString() === '%PDF-');
  const receiptTxt = exportReceiptText(inv);
  assert.match(receiptTxt, /RECEIPT/);
  assert.match(receiptTxt, /PAYMENT CONFIRMED/);
  assert.ok(renderReceiptPaper(inv).length > 5);
});

test('recordPayment rejects mismatched amounts and wrong status', () => {
  const draft = createInvoice({
    clientName: 'A',
    state: 'TX',
    locality: 'HARRIS',
    lineItems: [{ description: 'Prep', quantity: 1, unitPrice: 100, taxable: true }]
  });
  assert.throws(() => recordPayment(draft, { method: 'cash', amount: draft.total }), /status/);
  const approved = approveInvoice(submitForApproval(draft));
  assert.throws(() => recordPayment(approved, { method: 'cash', amount: 1 }), /does not match/);
  assert.throws(() => recordPayment(approved, { method: 'bitcoin', amount: approved.total }), /method/);
});
