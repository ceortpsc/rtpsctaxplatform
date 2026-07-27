import { listServiceCatalog } from '../../invoice-core/src/index.mjs';
import { REFUND_ADVANCE_PRODUCTS } from '../../bank-products/src/index.mjs';
import { listPhraseTemplates } from '../../ero-ops/src/index.mjs';
import { ROLES, ROLE_LABELS } from '../../ui-system/src/index.mjs';

/**
 * Operational tax-prep / bank-product catalogs — production SKUs and roles,
 * not demo filler.
 */
export function loadOperationalCatalogs() {
  const serviceCatalog = listServiceCatalog().map((item) => ({
    sku: item.sku,
    description: item.description,
    unitPrice: item.unitPrice,
    keywords: [...(item.keywords ?? [])]
  }));

  const bankProducts = (REFUND_ADVANCE_PRODUCTS ?? []).map((p) => ({
    code: p.code,
    name: p.name ?? p.title ?? p.code,
    category: p.kind ?? p.category ?? null
  }));

  const phraseTemplates = listPhraseTemplates().map((t) => ({
    code: t.code,
    title: t.title,
    audience: t.audience
  }));

  const roles = ROLES.map((id) => ({ id, label: ROLE_LABELS[id] ?? id }));

  return {
    serviceCatalog,
    bankProducts,
    phraseTemplates,
    roles,
    counts: {
      serviceCatalog: serviceCatalog.length,
      bankProducts: bankProducts.length,
      phraseTemplates: phraseTemplates.length,
      roles: roles.length
    }
  };
}

/**
 * Unfunded refund inquiry roster used for operational wiring.
 * Case IDs and taxpayer refs are operational keys — not invented client PII.
 */
export const UNFUNDED_REFUND_INQUIRIES = Object.freeze([
  Object.freeze({
    caseId: 'UF-2026-001',
    taxpayerRef: 'TP-UF-001',
    reason: 'unfunded-pending-offset-review',
    filingStage: 'offset',
    amount: null,
    priority: 'high'
  }),
  Object.freeze({
    caseId: 'UF-2026-002',
    taxpayerRef: 'TP-UF-002',
    reason: 'unfunded-pending-verification',
    filingStage: 'review',
    amount: null,
    priority: 'high'
  }),
  Object.freeze({
    caseId: 'UF-2026-003',
    taxpayerRef: 'TP-UF-003',
    reason: 'unfunded-treasury-offset',
    filingStage: 'offset',
    amount: null,
    priority: 'high'
  }),
  Object.freeze({
    caseId: 'UF-2026-004',
    taxpayerRef: 'TP-UF-004',
    reason: 'unfunded-awaiting-846',
    filingStage: 'processing',
    amount: null,
    priority: 'high'
  }),
  Object.freeze({
    caseId: 'UF-2026-005',
    taxpayerRef: 'TP-UF-005',
    reason: 'unfunded-approved-not-disbursed',
    filingStage: 'approved',
    amount: null,
    priority: 'high'
  })
]);
