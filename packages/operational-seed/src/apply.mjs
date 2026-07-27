import { loadFirmIdentity } from './firm.mjs';
import { UNFUNDED_REFUND_INQUIRIES } from './catalog.mjs';

/**
 * Apply operational seed into live in-memory stores.
 * Creates the firm account + operator staff contact only (no fake taxpayers).
 * Seeds unfunded refund inquiry cases when a refund store is provided.
 */
export async function applyOperationalSeed({
  crm = null,
  refunds = null,
  env = process.env,
  firm = null,
  inquiries = UNFUNDED_REFUND_INQUIRIES,
  seedRefunds = true
} = {}) {
  const identity = firm ?? loadFirmIdentity(env);
  const result = {
    firmAccountId: null,
    operatorContactId: null,
    refundCasesSeeded: [],
    skipped: []
  };

  if (crm) {
    const existingFirm = crm
      .listAccounts()
      .find((a) => a.type === 'firm' || a.tags?.includes('firm') || a.name === identity.company);

    let account = existingFirm ?? null;
    if (!account) {
      account = crm.createAccount({
        name: identity.company,
        type: 'firm',
        state: identity.state,
        locality: identity.city,
        notes: `${identity.application} · operational firm account`,
        tags: ['firm', 'rtpsc', 'operational']
      });
    }
    result.firmAccountId = account.id;

    if (identity.operator?.name) {
      const existingOp = crm
        .searchContacts(identity.operator.name, { limit: 20 })
        .find(
          (c) =>
            c.tags?.includes('operator') ||
            (identity.operator.email && c.email === identity.operator.email.toLowerCase())
        );

      if (existingOp) {
        result.operatorContactId = existingOp.id;
        result.skipped.push('operator-contact-exists');
      } else {
        const contact = crm.createContact({
          name: identity.operator.name,
          email: identity.operator.email ?? '',
          phone: identity.phone ?? '',
          taxpayerRef: null,
          accountId: account.id,
          createAccount: false,
          state: identity.state,
          locality: identity.city,
          address: identity.address ?? '',
          tags: ['operator', 'ero', 'staff'],
          source: 'operational-seed',
          notes: 'Firm ERO / operator contact from provisioned environment.'
        });
        result.operatorContactId = contact.id;
      }
    } else {
      result.skipped.push('operator-name-unset');
    }
  } else {
    result.skipped.push('crm-store-absent');
  }

  if (seedRefunds && refunds) {
    for (const inquiry of inquiries) {
      const existing = refunds.getCase(inquiry.caseId);
      if (existing) {
        result.skipped.push(`refund-exists:${inquiry.caseId}`);
        continue;
      }
      const ingested = await refunds.ingestEvent(
        {
          caseId: inquiry.caseId,
          taxpayerRef: inquiry.taxpayerRef,
          filingStage: inquiry.filingStage,
          amount: inquiry.amount,
          hasTranscript: false,
          sbtpgEnrolled: false,
          posPaid: false,
          source: 'operational-seed',
          reason: inquiry.reason
        },
        { source: 'operational-seed' }
      );
      result.refundCasesSeeded.push({
        caseId: ingested.case.id,
        taxpayerRef: ingested.case.taxpayerRef,
        reason: inquiry.reason,
        status: ingested.case.status,
        filingStage: ingested.case.filingStage
      });
    }
  } else if (seedRefunds) {
    result.skipped.push('refund-store-absent');
  }

  return result;
}

/** Restore CRM entities from a durable operational snapshot (no demo invent). */
export function hydrateCrmFromSnapshot(crm, snapshot) {
  if (!crm || !snapshot) return { accounts: 0, contacts: 0, interactions: 0 };
  const accounts = Array.isArray(snapshot.accounts) ? snapshot.accounts : [];
  const contacts = Array.isArray(snapshot.contacts) ? snapshot.contacts : [];
  const interactions = Array.isArray(snapshot.interactions) ? snapshot.interactions : [];

  for (const account of accounts) {
    if (crm.findAccount(account.id)) continue;
    crm._accounts.push({ ...account, contactIds: [...(account.contactIds ?? [])] });
  }
  for (const contact of contacts) {
    if (crm.findContact(contact.id)) continue;
    crm._contacts.push({ ...contact, tags: [...(contact.tags ?? [])] });
  }
  for (const interaction of interactions) {
    if (crm._interactions.some((i) => i.id === interaction.id)) continue;
    crm._interactions.push({ ...interaction });
  }
  return { accounts: accounts.length, contacts: contacts.length, interactions: interactions.length };
}
