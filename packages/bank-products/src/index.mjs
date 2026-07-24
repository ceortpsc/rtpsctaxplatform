// SBTPG bank-products scaffold: refund transfers & refund advances.
//
// Compliance note: this is a stub. No real Santa Barbara Tax Products Group
// (SBTPG) integration is performed. Enrollment records taxpayer intent + consent
// only; actual funding/disbursement is a payment operation that stays BLOCKED by
// a fail-safe payment gate until production approvals are satisfied.

import { evaluateEnvironmentProtection, loadRuntimeConfig } from '../../platform-core/src/index.mjs';

export const SBTPG_PROVIDER = Object.freeze({
  name: 'Santa Barbara Tax Products Group',
  code: 'SBTPG',
  role: 'Bank-products provider (refund transfers & refund advances)'
});

const BASE_DISCLOSURES = [
  'A Refund Advance / Refund Transfer is an optional bank product — it is not your tax refund.',
  'Availability, amount, and approval are subject to eligibility and the bank\'s underwriting.',
  'Any advance is repaid automatically from your federal and/or state tax refund.',
  'You are under no obligation to accept a bank product to have your return prepared or e-filed.'
];

export const REFUND_ADVANCE_PRODUCTS = Object.freeze([
  Object.freeze({
    code: 'RA-NF',
    name: 'No-Fee Refund Advance',
    kind: 'refund-advance',
    maxAmount: 4000,
    apr: 0,
    financeCharge: 0,
    requiresCreditCheck: false,
    disclosures: Object.freeze([...BASE_DISCLOSURES, 'No-Fee Refund Advance: 0% APR and $0 finance charge.'])
  }),
  Object.freeze({
    code: 'RA-FC',
    name: 'Refund Advance (Finance Charge)',
    kind: 'refund-advance',
    maxAmount: 7000,
    apr: 35.99,
    financeCharge: 'varies',
    requiresCreditCheck: true,
    disclosures: Object.freeze([
      ...BASE_DISCLOSURES,
      'Finance Charge product: APR up to 35.99%; a finance charge applies based on the advance amount.',
      'A soft/hard credit inquiry may be performed as part of underwriting.'
    ])
  }),
  Object.freeze({
    code: 'RT',
    name: 'Refund Transfer',
    kind: 'refund-transfer',
    maxAmount: 25000,
    apr: 0,
    financeCharge: 'flat-fee',
    requiresCreditCheck: false,
    disclosures: Object.freeze([...BASE_DISCLOSURES, 'Refund Transfer: a flat processing fee is deducted from your refund.'])
  })
]);

export function findProduct(code) {
  return REFUND_ADVANCE_PRODUCTS.find((product) => product.code === code) ?? null;
}

/** Stub SBTPG adapter (mirrors the secure-tunnel compliance pattern). */
export function createSbtpgAdapter() {
  return {
    provider: SBTPG_PROVIDER.code,
    status: 'stub',
    requirements: [
      'Executed SBTPG program agreement and bank onboarding.',
      'Security review for taxpayer PII, funding, and disbursement controls.',
      'Environment-provisioned credentials and approved endpoints.'
    ],
    todo: 'Implement only after bank/legal/security sign-off.'
  };
}

/**
 * Fail-safe payment gate for SBTPG bank products. Funding stays BLOCKED unless
 * the environment is production, provider secrets are configured, SBTPG is
 * explicitly enabled, disclosures are accepted, and the amount is within limits.
 */
export function evaluatePaymentGate({ config = loadRuntimeConfig(), product = null, requestedAmount = 0, consent = {}, enabled } = {}) {
  const env = evaluateEnvironmentProtection(config);
  const sbtpgEnabled = enabled ?? (process.env.SBTPG_ENABLED === 'true');

  const reasons = [];
  if (!env.safeguards.productionEnvironment) reasons.push(`Environment "${env.appEnv}" is not a production environment.`);
  if (!env.safeguards.secretsConfigured) reasons.push('Provider/API secrets are not fully configured.');
  if (!sbtpgEnabled) reasons.push('SBTPG_ENABLED is not set to "true".');
  if (consent.disclosuresAccepted !== true) reasons.push('Required disclosures have not been accepted.');
  if (product && requestedAmount > product.maxAmount) {
    reasons.push(`Requested amount exceeds the ${product.name} limit of $${product.maxAmount}.`);
  }
  if (product?.requiresCreditCheck && consent.creditCheckAuthorized !== true) {
    reasons.push(`${product.name} requires credit-check authorization.`);
  }

  const allowed = reasons.length === 0;
  return {
    provider: SBTPG_PROVIDER.code,
    allowed,
    blocked: !allowed,
    reasons,
    checkedAt: new Date().toISOString()
  };
}

let counter = 0;
function defaultId() {
  return `enr_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

/**
 * Validate an enrollment request and produce an enrollment record. Throws on
 * invalid input. Funding is never performed here — status reflects the gate.
 */
export function createEnrollment(input = {}, { config = loadRuntimeConfig(), now = () => new Date().toISOString(), idFactory, enabled } = {}) {
  const { applicationId, taxpayerRef, productCode, requestedAmount = 0, consent = {} } = input;

  if (!applicationId) throw new Error('applicationId is required.');
  const product = findProduct(productCode);
  if (!product) throw new Error(`Unknown product "${productCode}". Options: ${REFUND_ADVANCE_PRODUCTS.map((p) => p.code).join(', ')}.`);
  if (!(Number(requestedAmount) > 0)) throw new Error('requestedAmount must be greater than 0.');
  if (Number(requestedAmount) > product.maxAmount) {
    throw new Error(`Requested amount exceeds the ${product.name} limit of $${product.maxAmount}.`);
  }
  if (consent.disclosuresAccepted !== true) throw new Error('Disclosures must be accepted to enroll.');
  if (product.requiresCreditCheck && consent.creditCheckAuthorized !== true) {
    throw new Error(`${product.name} requires credit-check authorization.`);
  }

  const gate = evaluatePaymentGate({ config, product, requestedAmount: Number(requestedAmount), consent, enabled });

  return {
    id: (idFactory ?? defaultId)(),
    provider: SBTPG_PROVIDER,
    product: { code: product.code, name: product.name, kind: product.kind, apr: product.apr, maxAmount: product.maxAmount },
    applicationId: String(applicationId),
    taxpayerRef: taxpayerRef ? String(taxpayerRef) : 'unknown',
    requestedAmount: Number(requestedAmount),
    consent,
    disclosures: [...product.disclosures],
    fundingAllowed: gate.allowed,
    status: gate.allowed ? 'approved-pending-funding' : 'enrolled-pending-approval',
    gate,
    createdAt: now()
  };
}
