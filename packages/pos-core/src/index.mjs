// Point of Sale core — sessions, carts, CRM-linked checkout into invoice-core.
// Fully modular; integrates with CRM contacts and the invoicing machine.

import {
  approveInvoice,
  createInvoice,
  exportInvoicePdf,
  exportReceiptPdf,
  exportReceiptText,
  listServiceCatalog,
  recordPayment,
  submitForApproval
} from '../../invoice-core/src/index.mjs';
import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Create an in-memory POS store wired to a CRM store. */
export function createPosStore(crmStore, { idFactory, now = () => new Date().toISOString() } = {}) {
  if (!crmStore) throw new Error('createPosStore requires a CRM store.');
  const nextId = idFactory ?? defaultId;
  const sessions = [];
  const sales = [];

  function findSession(id) {
    return sessions.find((s) => s.id === id) ?? null;
  }

  function findSale(id) {
    return sales.find((s) => s.id === id) ?? null;
  }

  function openSession(input = {}) {
    const createdAt = now();
    let contact = null;
    if (input.contactId) {
      contact = crmStore.findContact(input.contactId);
      if (!contact) throw new Error(`Unknown CRM contact: ${input.contactId}`);
    }
    const session = {
      id: nextId('pos'),
      status: 'open',
      register: String(input.register ?? process.env.POS_REGISTER_ID ?? 'REG-RTPSC-1').trim() || 'REG-RTPSC-1',
      operator: String(input.operator ?? 'cashier').trim() || 'cashier',
      contactId: contact?.id ?? null,
      clientName: contact?.name ?? (String(input.clientName ?? 'Walk-in').trim() || 'Walk-in'),
      email: contact?.email ?? String(input.email ?? '').trim(),
      state: contact?.state ?? (String(input.state ?? '').trim().toUpperCase() || null),
      locality: contact?.locality ?? (String(input.locality ?? '').trim().toUpperCase() || null),
      lineItems: [],
      notes: String(input.notes ?? '').trim(),
      createdAt,
      updatedAt: createdAt,
      closedAt: null,
      saleId: null
    };
    sessions.unshift(session);
    if (sessions.length > 500) sessions.length = 500;
    return session;
  }

  function attachContact(sessionId, contactId) {
    const session = findSession(sessionId);
    if (!session) throw new Error(`Unknown POS session: ${sessionId}`);
    if (session.status !== 'open') throw new Error(`Session ${sessionId} is ${session.status}.`);
    const contact = crmStore.findContact(contactId);
    if (!contact) throw new Error(`Unknown CRM contact: ${contactId}`);
    session.contactId = contact.id;
    session.clientName = contact.name;
    session.email = contact.email;
    session.state = contact.state;
    session.locality = contact.locality;
    session.updatedAt = now();
    return session;
  }

  function addItem(sessionId, item = {}) {
    const session = findSession(sessionId);
    if (!session) throw new Error(`Unknown POS session: ${sessionId}`);
    if (session.status !== 'open') throw new Error(`Session ${sessionId} is ${session.status}.`);

    let sku = String(item.sku ?? '').trim();
    let description = String(item.description ?? '').trim();
    let unitPrice = Number(item.unitPrice);
    const catalog = listServiceCatalog();
    const match = sku ? catalog.find((c) => c.sku === sku) : null;
    if (match) {
      sku = match.sku;
      description = description || match.description;
      if (!Number.isFinite(unitPrice)) unitPrice = match.unitPrice;
    }
    if (!description) throw new Error('line item description (or known sku) is required.');
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('unitPrice must be a non-negative number.');

    const quantity = Number(item.quantity);
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const line = {
      sku: sku || `SKU-${session.lineItems.length + 1}`,
      description,
      quantity: qty,
      unitPrice: round2(unitPrice),
      taxable: item.taxable !== false
    };
    session.lineItems.push(line);
    session.updatedAt = now();
    return session;
  }

  function removeItem(sessionId, index) {
    const session = findSession(sessionId);
    if (!session) throw new Error(`Unknown POS session: ${sessionId}`);
    if (session.status !== 'open') throw new Error(`Session ${sessionId} is ${session.status}.`);
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= session.lineItems.length) throw new Error('Invalid line index.');
    session.lineItems.splice(i, 1);
    session.updatedAt = now();
    return session;
  }

  /**
   * Checkout: create invoice via invoice-core, auto-approve for POS tender,
   * record payment, link sale back to CRM contact, return receipt exports metadata.
   */
  function checkout(sessionId, payment = {}, { autoApprove = true } = {}) {
    const session = findSession(sessionId);
    if (!session) throw new Error(`Unknown POS session: ${sessionId}`);
    if (session.status !== 'open') throw new Error(`Session ${sessionId} is ${session.status}.`);
    if (session.lineItems.length === 0) throw new Error('Cart is empty.');
    if (!session.state) throw new Error('Session requires a tax jurisdiction state (set via CRM contact or session).');

    const method = String(payment.method ?? 'card').trim().toLowerCase();
    let invoice = createInvoice({
      clientName: session.clientName,
      email: session.email,
      state: session.state,
      locality: session.locality,
      notes: session.notes || `POS ${session.register} / ${session.operator}`,
      lineItems: session.lineItems
    });

    if (autoApprove) {
      invoice = submitForApproval(invoice);
      invoice = approveInvoice(invoice, { approver: `pos:${session.operator}` });
    } else {
      invoice = submitForApproval(invoice);
    }

    if (invoice.status === 'approved') {
      invoice = recordPayment(invoice, {
        method,
        amount: payment.amount ?? invoice.total,
        reference: payment.reference ?? `POS-${session.register}`
      });
    }

    const closedAt = now();
    const sale = {
      id: nextId('sale'),
      number: `POS-${closedAt.slice(0, 10).replace(/-/g, '')}-${saleSuffix(session.id)}`,
      sessionId: session.id,
      contactId: session.contactId,
      register: session.register,
      operator: session.operator,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      status: invoice.status,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      payment: invoice.payment,
      confirmation: invoice.confirmation,
      invoice,
      company: PLATFORM_IDENTITY.company,
      createdAt: closedAt,
      receiptText: exportReceiptText(invoice)
    };
    sales.unshift(sale);
    if (sales.length > 1000) sales.length = 1000;

    session.status = 'closed';
    session.closedAt = closedAt;
    session.saleId = sale.id;
    session.updatedAt = closedAt;

    if (session.contactId) {
      crmStore.updateContact(session.contactId, { lastSaleId: sale.id, lastInvoiceId: invoice.id });
      crmStore.logInteraction({
        contactId: session.contactId,
        type: 'sale',
        channel: 'pos',
        subject: `POS sale ${sale.number}`,
        body: `Settled $${invoice.total.toFixed(2)} via ${invoice.payment?.method ?? 'n/a'}. Invoice ${invoice.number}.`,
        relatedSaleId: sale.id,
        relatedInvoiceId: invoice.id
      });
    }

    return {
      session,
      sale,
      invoice,
      exports: {
        invoicePdf: exportInvoicePdf(invoice),
        receiptPdf: exportReceiptPdf(invoice),
        receiptText: sale.receiptText
      }
    };
  }

  function listSessions({ status, limit = 50 } = {}) {
    const pool = status ? sessions.filter((s) => s.status === status) : sessions;
    return pool.slice(0, limit);
  }

  function listSales({ contactId, limit = 50 } = {}) {
    const pool = contactId ? sales.filter((s) => s.contactId === contactId) : sales;
    return pool.slice(0, limit);
  }

  function catalog() {
    return listServiceCatalog();
  }

  function snapshot() {
    return {
      openSessions: sessions.filter((s) => s.status === 'open').length,
      sales: sales.length,
      sessions: sessions.length
    };
  }

  return {
    openSession,
    attachContact,
    addItem,
    removeItem,
    checkout,
    findSession,
    findSale,
    listSessions,
    listSales,
    catalog,
    snapshot,
    _sessions: sessions,
    _sales: sales
  };
}

function saleSuffix(sessionId) {
  return String(sessionId).slice(-4).toUpperCase();
}
