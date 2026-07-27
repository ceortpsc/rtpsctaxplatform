import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCrmStore } from '../packages/crm-core/src/index.mjs';
import { createRefundStore } from '../packages/refund-core/src/index.mjs';
import {
  applyOperationalSeed,
  buildOperationalSeed,
  loadFirmIdentity,
  resolveServiceWiring,
  seedAndWireApplication,
  UNFUNDED_REFUND_INQUIRIES
} from '../packages/operational-seed/src/index.mjs';

test('firm identity uses env operator without inventing demo clients', () => {
  const firm = loadFirmIdentity({
    FIRM_LEGAL_NAME: 'Ross Tax Pro Software Co',
    OPERATOR_NAME: 'R Condre Dvon Ross',
    OPERATOR_EMAIL: 'ceo@rosstaxsoftware.com',
    FIRM_CITY: 'Killeen',
    FIRM_STATE: 'TX',
    FIRM_POSTAL: '76549',
    FIRM_ADDRESS_LINE1: '2509 Cody Poe Rd Unit B',
    ERO_PTIN: 'P032155',
    ERO_CAF_NUMBER: '031676228',
    POS_REGISTER_ID: 'REG-RTPSC-1'
  });
  assert.equal(firm.company, 'Ross Tax Pro Software Co');
  assert.equal(firm.operator.name, 'R Condre Dvon Ross');
  assert.equal(firm.pos.registerId, 'REG-RTPSC-1');
  assert.equal(firm.completeness.operator, true);
  assert.match(firm.ero.ptin, /P032/);
  assert.doesNotMatch(JSON.stringify(firm), /Jordan Ellis|example\.com|TP-77/);
});

test('service wiring covers topology ports and env overrides', () => {
  const wiring = resolveServiceWiring({
    REFUND_STATUS_URL: 'http://127.0.0.1:3001',
    API_GATEWAY_URL: 'http://127.0.0.1:3000'
  });
  assert.ok(wiring.services.length >= 10);
  assert.equal(wiring.byId['refund-status-service'].baseUrl, 'http://127.0.0.1:3001');
  assert.equal(wiring.byId['refund-status-service'].wiredFrom, 'env');
  assert.ok(wiring.edges.some((e) => e.from === 'api-gateway' && e.to === 'refund-status-service'));
});

test('operational seed builds catalogs and unfunded inquiries', () => {
  const seed = buildOperationalSeed({
    env: {
      OPERATOR_NAME: 'R Condre Dvon Ross',
      OPERATOR_EMAIL: 'ceo@rosstaxsoftware.com',
      FIRM_STATE: 'TX'
    }
  });
  assert.equal(seed.kind, 'operational-seed');
  assert.ok(seed.catalogs.counts.serviceCatalog >= 5);
  assert.ok(seed.catalogs.counts.bankProducts >= 3);
  assert.equal(seed.unfundedRefundInquiries.length, UNFUNDED_REFUND_INQUIRIES.length);
  assert.doesNotMatch(JSON.stringify(seed), /Jordan Ellis|AUTH-POS-1|full-refund-demo/);
});

test('applyOperationalSeed wires firm CRM + unfunded refunds only', async () => {
  const crm = createCrmStore();
  const refunds = createRefundStore();
  const applied = await applyOperationalSeed({
    crm,
    refunds,
    env: {
      OPERATOR_NAME: 'R Condre Dvon Ross',
      OPERATOR_EMAIL: 'ceo@rosstaxsoftware.com',
      FIRM_LEGAL_NAME: 'Ross Tax Pro Software Co',
      FIRM_STATE: 'TX',
      FIRM_CITY: 'Killeen'
    }
  });
  assert.ok(applied.firmAccountId);
  assert.ok(applied.operatorContactId);
  assert.equal(applied.refundCasesSeeded.length, 5);
  assert.equal(crm.searchContacts('Jordan').length, 0);
  assert.ok(crm.searchContacts('Condre').length >= 1);
  assert.ok(refunds.getCase('UF-2026-001'));
});

test('seedAndWireApplication persists manifest under temp dir', async () => {
  const tmp = await mkdir(path.join(os.tmpdir(), `rtpsc-seed-${Date.now()}`), { recursive: true });
  try {
    const crm = createCrmStore();
    const result = await seedAndWireApplication({
      cwd: tmp,
      crm,
      refunds: null,
      persist: true,
      apply: true,
      seedRefunds: false,
      env: { OPERATOR_NAME: 'Operator', OPERATOR_EMAIL: 'ops@rosstaxsoftware.com', FIRM_STATE: 'TX' }
    });
    assert.equal(result.wiringReady, true);
    assert.match(result.filePath, /seed-manifest\.json$/);
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(result.filePath, 'utf8');
    assert.match(raw, /operational-seed/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
