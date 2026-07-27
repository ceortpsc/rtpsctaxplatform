// CRM core for RTPSC operations — contacts, accounts, interactions.
// Modular library consumed by POS and the pos-crm-service. Zero external deps.

let counter = 0;
function defaultId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36).padStart(3, '0')}`;
}

function normalizePhone(value) {
  return String(value ?? '').replace(/[^\d+]/g, '').slice(0, 20);
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 24);
}

/** Last-name–first alphabetical key for directory sort. */
export function contactSortKey(name) {
  const parts = String(name ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
}

function compareContactsByName(a, b) {
  return contactSortKey(a.name).localeCompare(contactSortKey(b.name), 'en', { sensitivity: 'base' });
}

/** Create an in-memory CRM store (contacts, accounts, interactions). */
export function createCrmStore({ idFactory, now = () => new Date().toISOString() } = {}) {
  const nextId = idFactory ?? defaultId;
  const contacts = [];
  const accounts = [];
  const interactions = [];

  function findContact(id) {
    return contacts.find((c) => c.id === id) ?? null;
  }

  function findAccount(id) {
    return accounts.find((a) => a.id === id) ?? null;
  }

  function createAccount(input = {}) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('account.name is required.');
    const createdAt = now();
    const account = {
      id: nextId('acct'),
      name,
      type: String(input.type ?? 'household').trim() || 'household',
      state: String(input.state ?? '').trim().toUpperCase() || null,
      locality: String(input.locality ?? input.parish ?? input.county ?? '').trim().toUpperCase() || null,
      notes: String(input.notes ?? '').trim(),
      tags: normalizeTags(input.tags),
      contactIds: [],
      createdAt,
      updatedAt: createdAt
    };
    accounts.unshift(account);
    if (accounts.length > 500) accounts.length = 500;
    return account;
  }

  function createContact(input = {}) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('contact.name is required.');
    const createdAt = now();
    let accountId = input.accountId ?? null;
    if (accountId && !findAccount(accountId)) throw new Error(`Unknown accountId: ${accountId}`);
    if (!accountId && input.createAccount !== false) {
      const account = createAccount({
        name: input.accountName ?? `${name} Household`,
        type: 'household',
        state: input.state,
        locality: input.locality ?? input.parish ?? input.county,
        tags: input.tags
      });
      accountId = account.id;
    }

    const contact = {
      id: nextId('crm'),
      name,
      email: String(input.email ?? '').trim().toLowerCase(),
      phone: normalizePhone(input.phone),
      taxpayerRef: String(input.taxpayerRef ?? '').trim() || null,
      accountId,
      state: String(input.state ?? '').trim().toUpperCase() || null,
      locality: String(input.locality ?? input.parish ?? input.county ?? '').trim().toUpperCase() || null,
      address: String(input.address ?? '').trim(),
      tags: normalizeTags(input.tags),
      source: String(input.source ?? 'manual').trim() || 'manual',
      status: 'active',
      lastSaleId: null,
      lastInvoiceId: null,
      notes: String(input.notes ?? '').trim(),
      createdAt,
      updatedAt: createdAt
    };
    contacts.unshift(contact);
    if (contacts.length > 2000) contacts.length = 2000;
    if (accountId) {
      const account = findAccount(accountId);
      if (account && !account.contactIds.includes(contact.id)) {
        account.contactIds.push(contact.id);
        account.updatedAt = createdAt;
      }
    }
    return contact;
  }

  function updateContact(id, patch = {}) {
    const contact = findContact(id);
    if (!contact) throw new Error(`Unknown contact: ${id}`);
    const next = { ...contact };
    if (patch.name != null) {
      const name = String(patch.name).trim();
      if (!name) throw new Error('contact.name cannot be empty.');
      next.name = name;
    }
    if (patch.email != null) next.email = String(patch.email).trim().toLowerCase();
    if (patch.phone != null) next.phone = normalizePhone(patch.phone);
    if (patch.taxpayerRef != null) next.taxpayerRef = String(patch.taxpayerRef).trim() || null;
    if (patch.state != null) next.state = String(patch.state).trim().toUpperCase() || null;
    if (patch.locality != null || patch.parish != null || patch.county != null) {
      next.locality = String(patch.locality ?? patch.parish ?? patch.county).trim().toUpperCase() || null;
    }
    if (patch.address != null) next.address = String(patch.address).trim();
    if (patch.notes != null) next.notes = String(patch.notes).trim();
    if (patch.tags != null) next.tags = normalizeTags(patch.tags);
    if (patch.status != null) next.status = String(patch.status).trim() || next.status;
    if (patch.lastSaleId != null) next.lastSaleId = patch.lastSaleId;
    if (patch.lastInvoiceId != null) next.lastInvoiceId = patch.lastInvoiceId;
    next.updatedAt = now();
    const idx = contacts.findIndex((c) => c.id === id);
    contacts[idx] = next;
    return next;
  }

  function searchContacts(query = '', { limit = 50, sort = 'alpha' } = {}) {
    const q = String(query).trim().toLowerCase();
    let pool = q
      ? contacts.filter((c) => {
          const hay = [c.name, c.email, c.phone, c.taxpayerRef, c.state, c.locality, ...(c.tags ?? [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
      : contacts.slice();
    if (sort === 'alpha' || sort === 'name') {
      pool = pool.slice().sort(compareContactsByName);
    }
    return pool.slice(0, limit);
  }

  /** Exact / prefix name lookup (alphabetical). */
  function lookupByName(nameQuery, { limit = 20 } = {}) {
    const q = String(nameQuery ?? '')
      .trim()
      .toLowerCase();
    if (!q) return [];
    return contacts
      .filter((c) => {
        const name = String(c.name).toLowerCase();
        const key = contactSortKey(c.name);
        return name.startsWith(q) || name.includes(q) || key.startsWith(q) || key.includes(q);
      })
      .sort(compareContactsByName)
      .slice(0, limit);
  }

  function findByTaxpayerRef(taxpayerRef) {
    if (!taxpayerRef) return null;
    const ref = String(taxpayerRef).trim();
    return contacts.find((c) => c.taxpayerRef === ref) ?? null;
  }

  function listContactsAlphabetical({ letter = '', limit = 200, offset = 0 } = {}) {
    let pool = contacts.slice().sort(compareContactsByName);
    const L = String(letter).trim().toUpperCase();
    if (L && L !== 'ALL') {
      pool = pool.filter((c) => {
        const ch = contactSortKey(c.name).charAt(0).toUpperCase() || '#';
        return L === '#' ? !/^[A-Z]$/.test(ch) : ch === L;
      });
    }
    return {
      total: pool.length,
      contacts: pool.slice(offset, offset + limit),
      letters: [
        ...new Set(
          contacts.map((c) => contactSortKey(c.name).charAt(0).toUpperCase() || '#').filter(Boolean)
        )
      ].sort()
    };
  }

  function logInteraction(input = {}) {
    const contactId = input.contactId;
    if (!contactId || !findContact(contactId)) throw new Error('interaction.contactId must reference an existing contact.');
    const createdAt = now();
    const record = {
      id: nextId('ix'),
      contactId,
      type: String(input.type ?? 'note').trim() || 'note',
      channel: String(input.channel ?? 'ops').trim() || 'ops',
      subject: String(input.subject ?? '').trim(),
      body: String(input.body ?? '').trim(),
      relatedSaleId: input.relatedSaleId ?? null,
      relatedInvoiceId: input.relatedInvoiceId ?? null,
      relatedTraceId: input.relatedTraceId ?? null,
      createdAt
    };
    interactions.unshift(record);
    if (interactions.length > 5000) interactions.length = 5000;
    updateContact(contactId, {});
    return record;
  }

  function listInteractions(contactId, { limit = 50 } = {}) {
    return interactions.filter((i) => i.contactId === contactId).slice(0, limit);
  }

  function snapshot() {
    return {
      contacts: contacts.length,
      accounts: accounts.length,
      interactions: interactions.length
    };
  }

  return {
    createContact,
    updateContact,
    findContact,
    searchContacts,
    lookupByName,
    findByTaxpayerRef,
    listContactsAlphabetical,
    createAccount,
    findAccount,
    listAccounts: () => accounts.slice(),
    logInteraction,
    listInteractions,
    snapshot,
    /** @internal test helpers */
    _contacts: contacts,
    _accounts: accounts,
    _interactions: interactions
  };
}
