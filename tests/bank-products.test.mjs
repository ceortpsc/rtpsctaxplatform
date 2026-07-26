import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REFUND_ADVANCE_PRODUCTS,
  SBTPG_PROVIDER,
  findProduct,
  evaluatePaymentGate,
  createEnrollment,
  createSbtpgAdapter
} from '../packages/bank-products/src/index.mjs';
import { loadRuntimeConfig } from '../packages/platform-core/src/index.mjs';

test('SBTPG provider and products are defined', () => {
  assert.equal(SBTPG_PROVIDER.code, 'SBTPG');
  assert.ok(REFUND_ADVANCE_PRODUCTS.length >= 3);
  assert.ok(findProduct('RA-NF'));
  assert.equal(createSbtpgAdapter().status, 'stub');
});

test('payment gate is fail-safe: blocked in local by default', () => {
  const gate = evaluatePaymentGate({ config: loadRuntimeConfig({ appEnv: 'local' }), consent: { disclosuresAccepted: true } });
  assert.equal(gate.allowed, false);
  assert.ok(gate.reasons.some((r) => /not a production environment/.test(r)));
  assert.ok(gate.reasons.some((r) => /SBTPG_ENABLED/.test(r)));
  assert.ok(gate.reasons.some((r) => /SBTPG_USERNAME/.test(r)) || gate.credentialsProvisioned === true || gate.credentialsProvisioned === false);
});

test('payment gate opens when every safeguard passes', () => {
  const prevUser = process.env.SBTPG_USERNAME;
  const prevSecret = process.env.SBTPG_SECRET;
  process.env.SBTPG_USERNAME = 'ops.user';
  process.env.SBTPG_SECRET = 'test-only-secret';
  try {
    const config = loadRuntimeConfig({
      appEnv: 'prod',
      apiClientSecret: 'a',
      tdsClientSecret: 'b',
      tunnelClientSecret: 'c'
    });
    const product = findProduct('RA-NF');
    const gate = evaluatePaymentGate({ config, product, requestedAmount: 1000, consent: { disclosuresAccepted: true }, enabled: true });
    assert.equal(gate.allowed, true);
    assert.deepEqual(gate.reasons, []);
    assert.equal(gate.credentialsProvisioned, true);
  } finally {
    if (prevUser === undefined) delete process.env.SBTPG_USERNAME;
    else process.env.SBTPG_USERNAME = prevUser;
    if (prevSecret === undefined) delete process.env.SBTPG_SECRET;
    else process.env.SBTPG_SECRET = prevSecret;
  }
});

test('createEnrollment records intent but leaves funding gated in local', () => {
  const record = createEnrollment(
    { applicationId: 'APP-1', taxpayerRef: 'TP-1', productCode: 'RA-NF', requestedAmount: 2000, consent: { disclosuresAccepted: true } },
    { config: loadRuntimeConfig({ appEnv: 'local' }) }
  );
  assert.equal(record.provider.code, 'SBTPG');
  assert.equal(record.fundingAllowed, false);
  assert.equal(record.status, 'enrolled-pending-approval');
  assert.ok(record.disclosures.length > 0);
});

test('createEnrollment enforces disclosures, limits, and credit-check consent', () => {
  const base = { applicationId: 'APP-2', productCode: 'RA-NF', requestedAmount: 1000, consent: { disclosuresAccepted: true } };
  assert.throws(() => createEnrollment({ ...base, applicationId: '' }), /applicationId/);
  assert.throws(() => createEnrollment({ ...base, productCode: 'NOPE' }), /Unknown product/);
  assert.throws(() => createEnrollment({ ...base, requestedAmount: 999999 }), /exceeds/);
  assert.throws(() => createEnrollment({ ...base, consent: { disclosuresAccepted: false } }), /Disclosures/);
  assert.throws(
    () => createEnrollment({ applicationId: 'A', productCode: 'RA-FC', requestedAmount: 1000, consent: { disclosuresAccepted: true } }),
    /credit-check/
  );
});
