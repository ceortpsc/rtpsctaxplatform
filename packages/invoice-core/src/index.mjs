// Invoicing machine core: AI-assisted data entry, tax calculations, payment
// approval/confirmation, PDF + receipt-paper export. Zero external deps.

import { calculateSalesTax, resolveJurisdiction, listStates, listLocalities, TAX_DATA_NOTICE } from '../../tax-data/src/index.mjs';
import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';
import { buildTextPdf, buildReceiptPdf } from './pdf.mjs';

export { buildTextPdf, buildReceiptPdf };

const SERVICE_CATALOG = Object.freeze([
  Object.freeze({ sku: 'TAX-PREP-1040', description: 'Individual tax preparation (Form 1040)', unitPrice: 250, keywords: ['1040', 'individual', 'personal', 'prep'] }),
  Object.freeze({ sku: 'TAX-PREP-SCHC', description: 'Schedule C / self-employed add-on', unitPrice: 125, keywords: ['schedule c', 'self-employed', 'sch c', 'business'] }),
  Object.freeze({ sku: 'TAX-PREP-CORP', description: 'Corporate / partnership return prep', unitPrice: 750, keywords: ['corporate', 'corp', '1120', '1065', 'partnership'] }),
  Object.freeze({ sku: 'EFILE-FED', description: 'Federal e-file transmission fee', unitPrice: 45, keywords: ['efile', 'e-file', 'federal', 'transmission'] }),
  Object.freeze({ sku: 'EFILE-STATE', description: 'State e-file transmission fee', unitPrice: 35, keywords: ['state efile', 'state filing'] }),
  Object.freeze({ sku: 'CONSULT-HR', description: 'Tax consultation (per hour)', unitPrice: 150, keywords: ['consult', 'consultation', 'hour', 'advisory'] }),
  Object.freeze({ sku: 'AMEND-RETURN', description: 'Amended return preparation', unitPrice: 300, keywords: ['amend', 'amended', '1040x'] }),
  Object.freeze({ sku: 'BOOKKEEP-MO', description: 'Monthly bookkeeping package', unitPrice: 200, keywords: ['bookkeeping', 'books', 'monthly'] })
]);

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function money(n) {
  return round2(Number(n) || 0).toFixed(2);
}

/** Suggest line items + jurisdiction from free-text / partial fields (local AI assist). */
export function assistDataEntry(input = {}) {
  const text = String(input.text ?? input.query ?? '').trim();
  const lower = text.toLowerCase();
  const suggestions = [];
  const matchedSkus = [];

  for (const item of SERVICE_CATALOG) {
    let score = 0;
    for (const kw of item.keywords) {
      if (lower.includes(kw)) score += 3;
    }
    if (lower.includes(item.sku.toLowerCase())) score += 5;
    if (score > 0) matchedSkus.push({ ...item, score });
  }
  matchedSkus.sort((a, b) => b.score - a.score);

  const qtyMatch = lower.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|x|units?)?/);
  const defaultQty = qtyMatch ? Number(qtyMatch[1]) : 1;

  const lineItems =
    matchedSkus.length > 0
      ? matchedSkus.slice(0, 4).map((item) => ({
          sku: item.sku,
          description: item.description,
          quantity: item.sku === 'CONSULT-HR' ? defaultQty : 1,
          unitPrice: item.unitPrice,
          taxable: true,
          confidence: Math.min(0.95, 0.55 + item.score * 0.08)
        }))
      : [
          {
            sku: 'TAX-PREP-1040',
            description: 'Individual tax preparation (Form 1040)',
            quantity: 1,
            unitPrice: 250,
            taxable: true,
            confidence: 0.35
          }
        ];

  const jurisdiction = resolveJurisdiction({
    state: input.state,
    locality: input.locality ?? input.parish ?? input.county,
    query: text || input.jurisdictionQuery
  });

  // Extract a client name heuristic: "for <Name>" or "client <Name>"
  let clientName = input.clientName ?? null;
  const nameMatch = text.match(/\b(?:for|client|customer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (!clientName && nameMatch) clientName = nameMatch[1];
  const dollarMatch = text.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
  if (dollarMatch && lineItems[0]) {
    lineItems[0] = { ...lineItems[0], unitPrice: Number(dollarMatch[1]), confidence: Math.max(lineItems[0].confidence, 0.7) };
  }

  suggestions.push({
    type: 'info',
    message: matchedSkus.length
      ? `Matched ${matchedSkus.length} catalog service(s) from your description.`
      : 'No strong catalog match — defaulted to individual tax prep. Refine the description for better AI assist.'
  });
  if (jurisdiction.found) {
    suggestions.push({
      type: 'tax',
      message: `Jurisdiction ${jurisdiction.state.code}${jurisdiction.locality ? ` / ${jurisdiction.locality.name}` : ''} → combined rate ${jurisdiction.combinedRate}%.`
    });
  } else {
    suggestions.push({ type: 'warning', message: 'No jurisdiction detected — set state and county/parish for tax calculation.' });
  }

  return {
    engine: 'invoice-ai-assist',
    mode: 'local-heuristic',
    client: {
      name: clientName ?? '',
      email: input.email ?? '',
      state: jurisdiction.state?.code ?? input.state ?? '',
      locality: jurisdiction.locality?.code ?? input.locality ?? ''
    },
    lineItems,
    jurisdiction,
    catalog: SERVICE_CATALOG,
    suggestions,
    notice: TAX_DATA_NOTICE
  };
}

export function listServiceCatalog() {
  return SERVICE_CATALOG.map((s) => ({ ...s }));
}

/** Compute subtotal, tax, and total for line items + jurisdiction. */
export function calculateInvoiceTotals(lineItems = [], jurisdictionInput = {}) {
  const lines = (lineItems ?? []).map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const amount = round2(quantity * unitPrice);
    const taxable = item.taxable !== false;
    return {
      lineNumber: index + 1,
      sku: item.sku ?? `LINE-${index + 1}`,
      description: item.description ?? '',
      quantity,
      unitPrice: round2(unitPrice),
      amount,
      taxable
    };
  });

  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const taxableSubtotal = round2(lines.filter((l) => l.taxable).reduce((sum, l) => sum + l.amount, 0));
  const taxCalc = calculateSalesTax(taxableSubtotal, jurisdictionInput);
  const tax = taxCalc.tax;
  const total = round2(subtotal + tax);

  return {
    lineItems: lines,
    subtotal,
    taxableSubtotal,
    tax,
    total,
    taxDetail: taxCalc,
    currency: 'USD'
  };
}

/**
 * Create a draft invoice for the operations system.
 */
export function createInvoice(input = {}, { now = () => new Date().toISOString(), idFactory } = {}) {
  const clientName = String(input.clientName ?? input.client?.name ?? '').trim();
  if (!clientName) throw new Error('clientName is required.');

  const jurisdictionInput = {
    state: input.state ?? input.client?.state,
    locality: input.locality ?? input.parish ?? input.county ?? input.client?.locality,
    query: input.jurisdictionQuery
  };
  const totals = calculateInvoiceTotals(input.lineItems ?? [], jurisdictionInput);
  if (totals.lineItems.length === 0) throw new Error('At least one line item is required.');

  const id = (idFactory ?? (() => defaultId('inv')))();
  const createdAt = now();
  return {
    id,
    number: input.number ?? `INV-${createdAt.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
    status: 'draft',
    company: PLATFORM_IDENTITY.company,
    application: PLATFORM_IDENTITY.application,
    client: {
      name: clientName,
      email: String(input.email ?? input.client?.email ?? '').trim(),
      phone: String(input.phone ?? input.client?.phone ?? '').trim(),
      address: String(input.address ?? input.client?.address ?? '').trim(),
      state: totals.taxDetail.jurisdiction.state?.code ?? jurisdictionInput.state ?? null,
      locality: totals.taxDetail.jurisdiction.locality?.code ?? null,
      localityName: totals.taxDetail.jurisdiction.locality?.name ?? null
    },
    lineItems: totals.lineItems,
    subtotal: totals.subtotal,
    taxableSubtotal: totals.taxableSubtotal,
    tax: totals.tax,
    total: totals.total,
    currency: 'USD',
    taxDetail: totals.taxDetail,
    payment: null,
    confirmation: null,
    notes: String(input.notes ?? '').trim(),
    createdAt,
    updatedAt: createdAt,
    taxDataNotice: TAX_DATA_NOTICE
  };
}

/** Move draft → pending-approval (operations queue). */
export function submitForApproval(invoice, { now = () => new Date().toISOString() } = {}) {
  if (!invoice) throw new Error('invoice is required.');
  if (!['draft', 'rejected'].includes(invoice.status)) {
    throw new Error(`Cannot submit invoice in status "${invoice.status}".`);
  }
  return {
    ...invoice,
    status: 'pending-approval',
    updatedAt: now()
  };
}

/** Approve a pending invoice (payment may then be recorded). */
export function approveInvoice(invoice, { approver = 'operator', now = () => new Date().toISOString() } = {}) {
  if (!invoice) throw new Error('invoice is required.');
  if (invoice.status !== 'pending-approval') {
    throw new Error(`Cannot approve invoice in status "${invoice.status}".`);
  }
  return {
    ...invoice,
    status: 'approved',
    approval: { approver, approvedAt: now() },
    updatedAt: now()
  };
}

/**
 * Record payment against an approved invoice and generate a confirmation.
 * Fail-safe: amount must match total (within 1 cent) unless partialAllowed.
 */
export function recordPayment(
  invoice,
  paymentInput = {},
  { now = () => new Date().toISOString(), idFactory, partialAllowed = false } = {}
) {
  if (!invoice) throw new Error('invoice is required.');
  if (!['approved', 'partially-paid'].includes(invoice.status)) {
    throw new Error(`Cannot record payment for invoice in status "${invoice.status}".`);
  }

  const method = String(paymentInput.method ?? '').trim().toLowerCase();
  const allowedMethods = new Set(['cash', 'check', 'card', 'ach', 'other']);
  if (!allowedMethods.has(method)) throw new Error('payment.method must be cash|check|card|ach|other.');

  const amount = round2(paymentInput.amount ?? invoice.total);
  if (!(amount > 0)) throw new Error('payment.amount must be greater than zero.');
  if (!partialAllowed && Math.abs(amount - invoice.total) > 0.009) {
    throw new Error(`Payment amount $${money(amount)} does not match invoice total $${money(invoice.total)}.`);
  }

  const paidAt = now();
  const confirmationId = (idFactory ?? (() => defaultId('cfm')))();
  const confirmation = {
    id: confirmationId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    clientName: invoice.client.name,
    amount,
    method,
    reference: String(paymentInput.reference ?? '').trim() || null,
    paidAt,
    status: 'confirmed',
    message: `Payment of $${money(amount)} via ${method} confirmed for ${invoice.number}.`
  };

  const fullyPaid = Math.abs(amount - invoice.total) <= 0.009 || amount >= invoice.total;
  return {
    ...invoice,
    status: fullyPaid ? 'paid' : 'partially-paid',
    payment: {
      amount,
      method,
      reference: confirmation.reference,
      paidAt,
      confirmationId
    },
    confirmation,
    updatedAt: paidAt
  };
}

function invoiceHeaderLines(invoice) {
  return [
    PLATFORM_IDENTITY.company,
    PLATFORM_IDENTITY.application,
    '────────────────────────────────────────',
    `INVOICE  ${invoice.number}`,
    `Status:  ${invoice.status}`,
    `Date:    ${invoice.createdAt.slice(0, 10)}`,
    '',
    'Bill To:',
    `  ${invoice.client.name}`,
    invoice.client.email ? `  ${invoice.client.email}` : null,
    invoice.client.phone ? `  ${invoice.client.phone}` : null,
    invoice.client.address ? `  ${invoice.client.address}` : null,
    invoice.client.state
      ? `  ${invoice.client.localityName ?? invoice.client.locality ?? ''} ${invoice.client.state}`.trim()
      : null,
    '',
    'Line Items:',
    'Qty  Description                         Amount',
    '---- ----------------------------------- --------'
  ].filter((l) => l !== null);
}

function invoiceBodyLines(invoice) {
  const lines = [];
  for (const item of invoice.lineItems) {
    const desc = `${item.description}`.slice(0, 35).padEnd(35);
    lines.push(`${String(item.quantity).padStart(3)}  ${desc} $${money(item.amount).padStart(7)}`);
  }
  lines.push('');
  lines.push(`Subtotal:                              $${money(invoice.subtotal).padStart(7)}`);
  const rate = invoice.taxDetail?.rate ?? 0;
  const jName = invoice.taxDetail?.jurisdiction?.locality?.name ?? invoice.taxDetail?.jurisdiction?.state?.name ?? 'n/a';
  lines.push(`Tax (${rate}% · ${jName}):`.slice(0, 38).padEnd(38) + `$${money(invoice.tax).padStart(7)}`);
  lines.push(`TOTAL:                                 $${money(invoice.total).padStart(7)}`);
  if (invoice.payment) {
    lines.push('');
    lines.push(`Paid: $${money(invoice.payment.amount)} via ${invoice.payment.method}`);
    if (invoice.confirmation) lines.push(`Confirmation: ${invoice.confirmation.id}`);
  }
  if (invoice.notes) {
    lines.push('');
    lines.push(`Notes: ${invoice.notes}`);
  }
  lines.push('');
  lines.push('Reference tax rates — verify before production use.');
  return lines;
}

/** Plain-text invoice document lines. */
export function renderInvoiceText(invoice) {
  return [...invoiceHeaderLines(invoice), ...invoiceBodyLines(invoice)];
}

/** Receipt-paper layout (42-column thermal style). */
export function renderReceiptPaper(invoice) {
  const W = 42;
  const center = (s) => {
    const t = String(s).slice(0, W);
    const pad = Math.max(0, Math.floor((W - t.length) / 2));
    return ' '.repeat(pad) + t;
  };
  const line = (left, right) => {
    const l = String(left).slice(0, W - 10);
    const r = String(right).slice(0, 10);
    return l + ' '.repeat(Math.max(1, W - l.length - r.length)) + r;
  };
  const dash = '-'.repeat(W);
  const out = [
    center(PLATFORM_IDENTITY.company),
    center('RECEIPT'),
    dash,
    line('Invoice', invoice.number),
    line('Status', invoice.status),
    line('Client', invoice.client.name),
    dash
  ];
  for (const item of invoice.lineItems) {
    out.push(String(item.description).slice(0, W));
    out.push(line(`  ${item.quantity} x $${money(item.unitPrice)}`, `$${money(item.amount)}`));
  }
  out.push(dash);
  out.push(line('Subtotal', `$${money(invoice.subtotal)}`));
  out.push(line(`Tax ${invoice.taxDetail?.rate ?? 0}%`, `$${money(invoice.tax)}`));
  out.push(line('TOTAL', `$${money(invoice.total)}`));
  if (invoice.payment) {
    out.push(dash);
    out.push(line('Paid', `$${money(invoice.payment.amount)}`));
    out.push(line('Method', invoice.payment.method));
    if (invoice.confirmation) out.push(line('Conf#', invoice.confirmation.id.slice(-12)));
    out.push(center('PAYMENT CONFIRMED'));
  }
  out.push(dash);
  out.push(center('Thank you'));
  out.push(center(new Date(invoice.updatedAt ?? invoice.createdAt).toLocaleString('en-US')));
  return out;
}

/** Export invoice as PDF Buffer. */
export function exportInvoicePdf(invoice) {
  return buildTextPdf(renderInvoiceText(invoice), { title: `Invoice ${invoice.number}` });
}

/** Export thermal-style receipt as PDF Buffer. */
export function exportReceiptPdf(invoice) {
  return buildReceiptPdf(renderReceiptPaper(invoice), { title: `Receipt ${invoice.number}` });
}

/** Export receipt paper as UTF-8 text (for printers / ESC-POS bridges). */
export function exportReceiptText(invoice) {
  return `${renderReceiptPaper(invoice).join('\n')}\n`;
}

/** Jurisdiction helpers re-exported for the operations UI. */
export function taxLookups() {
  return {
    states: listStates(),
    localitiesByState: Object.fromEntries(listStates().map((s) => [s.code, listLocalities(s.code)])),
    notice: TAX_DATA_NOTICE
  };
}

export { resolveJurisdiction, calculateSalesTax, listStates, listLocalities };
