import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createServiceDescriptor,
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  redactConfig
} from '../../../packages/platform-core/src/index.mjs';
import { createCrmStore } from '../../../packages/crm-core/src/index.mjs';
import { createPosStore } from '../../../packages/pos-core/src/index.mjs';
import {
  createSbtpgTraceStore,
  listPhraseTemplates,
  phraseForEro,
  scoreRefundIntelligence
} from '../../../packages/ero-ops/src/index.mjs';
import { taxLookups } from '../../../packages/invoice-core/src/index.mjs';
import { createRefundStore } from '../../../packages/refund-core/src/index.mjs';
import {
  buildEroClientStatusMatrix,
  createMasterfileStore,
  describeClientMasterfile
} from '../../../packages/client-masterfile/src/index.mjs';
import { createSyncEngine } from '../../../packages/data-sync/src/index.mjs';
import { serveDesignSystemAsset } from '../../../packages/ui-design-system/src/index.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3006;
const SYNC_DIR = process.env.DATA_SYNC_DIR ?? path.resolve(process.cwd(), 'data', 'sync');
const SYNC_STORE = process.env.DATA_SYNC_STORE ?? path.join(SYNC_DIR, 'store.json');

export const posCrmDescriptor = createServiceDescriptor({
  name: 'pos-crm-service',
  domain: 'operations',
  responsibilities: [
    'Operate the CRM for tax-prep clients (contacts, accounts, interactions).',
    'Run the Point of Sale register fully linked to CRM and the invoicing machine.',
    'Track SBTPG report traces, automate ERO phrasing, and surface refund intelligence.',
    'Manage the alphabetical client master file and Full ERO Client Status matrix.',
    'Apply synchronized client/interaction tables from @rtp/data-sync into the live CRM store.'
  ],
  dependencies: [
    '@rtp/crm-core',
    '@rtp/pos-core',
    '@rtp/ero-ops',
    '@rtp/invoice-core',
    '@rtp/tax-data',
    '@rtp/bank-products',
    '@rtp/client-masterfile',
    '@rtp/refund-core',
    '@rtp/data-sync'
  ]
});

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf'
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}

function sendBinary(response, statusCode, buffer, contentType, filename) {
  response.writeHead(statusCode, {
    'content-type': contentType,
    'content-disposition': `attachment; filename="${filename}"`,
    'content-length': buffer.length
  });
  response.end(buffer);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 400_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw === '') return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

async function serveStatic(response, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.join(publicDir, relative);
  if (!resolved.startsWith(publicDir)) return sendJson(response, 403, { error: 'forbidden' });
  try {
    const file = await readFile(resolved);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(resolved)] ?? 'application/octet-stream' });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: 'not_found', path: urlPath });
  }
}

export function createPosCrmServer() {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const crm = createCrmStore();
  const pos = createPosStore(crm);
  const traces = createSbtpgTraceStore();
  const refunds = createRefundStore();
  const masterfile = createMasterfileStore();
  const sync = createSyncEngine({ persistPath: SYNC_STORE });

  const demoClients = [
    {
      name: 'Jordan Ellis',
      email: 'jordan@example.com',
      phone: '5045550100',
      taxpayerRef: 'TP-77',
      state: 'LA',
      locality: 'ORLEANS',
      tags: ['demo', 'efile'],
      notes: 'Seeded CRM contact for POS + ERO demos.',
      filingStage: 'approved',
      amount: 3200,
      sbtpg: { productCode: 'RA-NF', stage: 'underwriting', detail: 'Docs in review' }
    },
    {
      name: 'Alex Rivera',
      email: 'alex@example.com',
      phone: '5045550199',
      taxpayerRef: 'TP-88',
      state: 'LA',
      locality: 'JEFFERSON',
      tags: ['demo'],
      filingStage: 'processing',
      amount: 2100,
      sbtpg: { productCode: 'RT', stage: 'received', detail: 'RT product report received' }
    },
    {
      name: 'Casey Nguyen',
      email: 'casey@example.com',
      phone: '7135550142',
      taxpayerRef: 'TP-101',
      state: 'TX',
      locality: 'HARRIS',
      tags: ['demo', 'pos'],
      filingStage: 'received',
      amount: 1800
    },
    {
      name: 'Blake Okonkwo',
      email: 'blake@example.com',
      phone: '5045550220',
      taxpayerRef: 'TP-55',
      state: 'LA',
      locality: 'EAST_BATON_ROUGE',
      tags: ['demo'],
      filingStage: 'paid',
      amount: 4100,
      sbtpg: { productCode: 'RA-FC', stage: 'funded', detail: 'Funded to client' }
    },
    {
      name: 'Morgan Patel',
      email: 'morgan@example.com',
      phone: '2145550188',
      taxpayerRef: 'TP-42',
      state: 'TX',
      locality: 'DALLAS',
      tags: ['demo', 'efile'],
      filingStage: 'review',
      amount: 2750
    }
  ];

  let seed = null;
  for (const demo of demoClients) {
    const contact = crm.createContact({
      name: demo.name,
      email: demo.email,
      phone: demo.phone,
      taxpayerRef: demo.taxpayerRef,
      state: demo.state,
      locality: demo.locality,
      tags: demo.tags,
      source: 'seed',
      notes: demo.notes ?? `Seeded master-file client ${demo.name}.`
    });
    if (!seed) seed = contact;
    refunds.ensureCase(`CASE-${demo.taxpayerRef}`, {
      taxpayerRef: demo.taxpayerRef,
      filingStage: demo.filingStage,
      amount: demo.amount,
      source: 'seed'
    });
    if (demo.sbtpg) {
      traces.trackReport({
        contactId: contact.id,
        taxpayerRef: demo.taxpayerRef,
        productCode: demo.sbtpg.productCode,
        stage: demo.sbtpg.stage,
        detail: demo.sbtpg.detail
      });
    }
  }
  masterfile.syncFromCrm(crm);

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { status: 'ok', service: posCrmDescriptor.name, environment: config.appEnv });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: posCrmDescriptor,
          runtime: redactConfig(config),
          environmentProtection: evaluateEnvironmentProtection(config),
          metadata: {
            crm: crm.snapshot(),
            pos: pos.snapshot(),
            traces: traces.listTraces({ limit: 1 }).length,
            masterfile: masterfile.snapshot(),
            refundCases: refunds.listCases({ limit: 1000 }).length,
            seedContactId: seed.id,
            clientMasterfile: describeClientMasterfile(),
            seedContactId: seed.id,
            dataSync: sync.store.count()
          }
        });
      }

      if (request.method === 'GET' && pathname === '/api/sync') {
        await sync.store.loadPersisted();
        return sendJson(response, 200, { ...sync.status(), directory: SYNC_DIR, crm: crm.snapshot() });
      }

      if (request.method === 'POST' && pathname === '/api/sync/project') {
        await sync.store.loadPersisted();
        const body = await readBody(request);
        if (body.csv && body.table) {
          sync.importCsvText(body.table, body.csv, { source: 'pos-crm-sync' });
        } else if (Array.isArray(body.rows) && body.table) {
          sync.importRows(body.table, body.rows, { source: 'pos-crm-sync' });
        } else if (body.runDirectory !== false) {
          await sync.syncDirectory(body.directory ?? SYNC_DIR);
        }
        const projection = await sync.project({ crmStore: crm, includeTaxSeed: true });
        await sync.store.persist();
        return sendJson(response, 200, {
          crm: crm.snapshot(),
          projections: Object.fromEntries(
            Object.entries(projection.projections).map(([k, v]) => [k, v.summary ?? v])
          ),
          counts: sync.store.count()
        });
      }

      if (request.method === 'GET' && pathname === '/api/tax') {
        return sendJson(response, 200, taxLookups());
      }

      if (request.method === 'GET' && pathname === '/api/catalog') {
        return sendJson(response, 200, { catalog: pos.catalog() });
      }

      // ── CRM ──────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/api/contacts') {
        const q = url.searchParams.get('q') ?? '';
        const letter = url.searchParams.get('letter') ?? '';
        const sort = url.searchParams.get('sort') ?? 'alpha';
        if (letter) {
          const listing = crm.listContactsAlphabetical({ letter });
          const filtered = q
            ? listing.contacts.filter((c) => {
                const hay = [c.name, c.email, c.phone, c.taxpayerRef].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q.toLowerCase());
              })
            : listing.contacts;
          return sendJson(response, 200, {
            contacts: filtered,
            letters: listing.letters,
            total: filtered.length,
            sort: 'alpha'
          });
        }
        return sendJson(response, 200, {
          contacts: crm.searchContacts(q, { sort }),
          sort
        });
      }

      if (request.method === 'GET' && pathname === '/api/contacts/lookup') {
        const name = url.searchParams.get('name') ?? url.searchParams.get('q') ?? '';
        return sendJson(response, 200, { matches: crm.lookupByName(name) });
      }

      if (request.method === 'POST' && pathname === '/api/contacts') {
        const body = await readBody(request);
        try {
          const contact = crm.createContact(body);
          masterfile.upsert({
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            taxpayerRef: contact.taxpayerRef,
            contactId: contact.id,
            accountId: contact.accountId,
            state: contact.state,
            locality: contact.locality,
            address: contact.address,
            tags: contact.tags,
            crmStatus: contact.status,
            notes: contact.notes,
            source: 'crm'
          });
          return sendJson(response, 201, { contact });
        } catch (error) {
          return sendJson(response, 400, { error: 'invalid_contact', message: error.message });
        }
      }

      const contactMatch = pathname.match(/^\/api\/contacts\/([^/]+)(?:\/(interactions))?$/);
      if (contactMatch && contactMatch[1] !== 'lookup') {
        const id = decodeURIComponent(contactMatch[1]);
        const contact = crm.findContact(id);
        if (!contact) return sendJson(response, 404, { error: 'contact_not_found', id });

        if (request.method === 'GET' && !contactMatch[2]) {
          return sendJson(response, 200, {
            contact,
            account: contact.accountId ? crm.findAccount(contact.accountId) : null,
            interactions: crm.listInteractions(id),
            sales: pos.listSales({ contactId: id }),
            traces: traces.listTraces({ contactId: id }),
            masterfile: contact.taxpayerRef
              ? masterfile.findByTaxpayerRef(contact.taxpayerRef)
              : null
          });
        }

        if (request.method === 'PATCH' && !contactMatch[2]) {
          const body = await readBody(request);
          try {
            const updated = crm.updateContact(id, body);
            masterfile.upsert({
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              taxpayerRef: updated.taxpayerRef,
              contactId: updated.id,
              accountId: updated.accountId,
              state: updated.state,
              locality: updated.locality,
              address: updated.address,
              tags: updated.tags,
              crmStatus: updated.status,
              notes: updated.notes,
              source: 'crm'
            });
            return sendJson(response, 200, { contact: updated });
          } catch (error) {
            return sendJson(response, 400, { error: 'update_failed', message: error.message });
          }
        }

        if (request.method === 'POST' && contactMatch[2] === 'interactions') {
          const body = await readBody(request);
          try {
            const interaction = crm.logInteraction({ ...body, contactId: id });
            return sendJson(response, 201, { interaction });
          } catch (error) {
            return sendJson(response, 400, { error: 'interaction_failed', message: error.message });
          }
        }
      }

      if (request.method === 'GET' && pathname === '/api/accounts') {
        return sendJson(response, 200, { accounts: crm.listAccounts() });
      }

      // ── POS ──────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/api/pos/sessions') {
        const status = url.searchParams.get('status') ?? undefined;
        return sendJson(response, 200, { sessions: pos.listSessions({ status }) });
      }

      if (request.method === 'POST' && pathname === '/api/pos/sessions') {
        const body = await readBody(request);
        try {
          const session = pos.openSession(body);
          return sendJson(response, 201, { session });
        } catch (error) {
          return sendJson(response, 400, { error: 'session_failed', message: error.message });
        }
      }

      const sessionMatch = pathname.match(
        /^\/api\/pos\/sessions\/([^/]+)(?:\/(attach|items|checkout))?$/
      );
      if (sessionMatch) {
        const id = decodeURIComponent(sessionMatch[1]);
        const action = sessionMatch[2] ?? null;
        const session = pos.findSession(id);
        if (!session) return sendJson(response, 404, { error: 'session_not_found', id });

        if (request.method === 'GET' && !action) {
          return sendJson(response, 200, { session });
        }

        if (request.method === 'POST' && action === 'attach') {
          const body = await readBody(request);
          try {
            return sendJson(response, 200, { session: pos.attachContact(id, body.contactId) });
          } catch (error) {
            return sendJson(response, 400, { error: 'attach_failed', message: error.message });
          }
        }

        if (request.method === 'POST' && action === 'items') {
          const body = await readBody(request);
          try {
            if (body.removeIndex != null) {
              return sendJson(response, 200, { session: pos.removeItem(id, body.removeIndex) });
            }
            return sendJson(response, 200, { session: pos.addItem(id, body) });
          } catch (error) {
            return sendJson(response, 400, { error: 'cart_failed', message: error.message });
          }
        }

        if (request.method === 'POST' && action === 'checkout') {
          const body = await readBody(request);
          try {
            const result = pos.checkout(id, body);
            // Drop binary buffers from JSON; expose download routes instead.
            return sendJson(response, 201, {
              session: result.session,
              sale: result.sale,
              invoice: {
                id: result.invoice.id,
                number: result.invoice.number,
                status: result.invoice.status,
                subtotal: result.invoice.subtotal,
                tax: result.invoice.tax,
                total: result.invoice.total,
                confirmation: result.invoice.confirmation,
                payment: result.invoice.payment,
                taxDetail: result.invoice.taxDetail
              },
              downloads: {
                invoicePdf: `/api/pos/sales/${result.sale.id}/pdf`,
                receiptPdf: `/api/pos/sales/${result.sale.id}/receipt.pdf`,
                receiptTxt: `/api/pos/sales/${result.sale.id}/receipt.txt`
              }
            });
          } catch (error) {
            return sendJson(response, 400, { error: 'checkout_failed', message: error.message });
          }
        }
      }

      if (request.method === 'GET' && pathname === '/api/pos/sales') {
        const contactId = url.searchParams.get('contactId') ?? undefined;
        return sendJson(response, 200, { sales: pos.listSales({ contactId }) });
      }

      const saleMatch = pathname.match(/^\/api\/pos\/sales\/([^/]+)(?:\/(pdf|receipt\.pdf|receipt\.txt))?$/);
      if (request.method === 'GET' && saleMatch) {
        const sale = pos.findSale(decodeURIComponent(saleMatch[1]));
        if (!sale) return sendJson(response, 404, { error: 'sale_not_found', id: saleMatch[1] });
        const action = saleMatch[2] ?? null;
        if (!action) return sendJson(response, 200, { sale });

        // Rebuild exports from linked invoice fields via a synthetic invoice-shaped object
        // already stored receipt text; for PDF re-checkout exports we keep receiptText and
        // regenerate from stored sale snapshot using invoice-core helpers through a lightweight path.
        if (action === 'receipt.txt') {
          return sendBinary(response, 200, Buffer.from(sale.receiptText, 'utf8'), 'text/plain; charset=utf-8', `${sale.number}-receipt.txt`);
        }
        const { exportInvoicePdf, exportReceiptPdf } = await import('../../../packages/invoice-core/src/index.mjs');
        if (action === 'pdf') {
          return sendBinary(response, 200, exportInvoicePdf(sale.invoice), 'application/pdf', `${sale.number}.pdf`);
        }
        if (action === 'receipt.pdf') {
          return sendBinary(response, 200, exportReceiptPdf(sale.invoice), 'application/pdf', `${sale.number}-receipt.pdf`);
        }
      }

      // ── ERO / SBTPG / Intelligence ───────────────────────
      if (request.method === 'GET' && pathname === '/api/ero/phrases') {
        return sendJson(response, 200, { templates: listPhraseTemplates() });
      }

      if (request.method === 'POST' && pathname === '/api/ero/phrases') {
        const body = await readBody(request);
        try {
          return sendJson(response, 200, { phrase: phraseForEro(body.code, body.context ?? body) });
        } catch (error) {
          return sendJson(response, 400, { error: 'phrase_failed', message: error.message });
        }
      }

      if (request.method === 'POST' && pathname === '/api/ero/intelligence') {
        const body = await readBody(request);
        const gate = traces.gateSnapshot(config);
        const intel = scoreRefundIntelligence({
          ...body,
          paymentGateBlocked: gate.paymentGate.blocked,
          sbtpgEnrolled: body.sbtpgEnrolled === true
        });
        const brief = phraseForEro('REFUND-INTEL-BRIEF', {
          clientName: body.clientName ?? 'Client',
          score: intel.score,
          band: intel.band,
          drivers: intel.drivers.join('; '),
          recommendation: intel.recommendation
        });
        return sendJson(response, 200, { intelligence: intel, brief, gate });
      }

      if (request.method === 'GET' && pathname === '/api/sbtpg/traces') {
        const contactId = url.searchParams.get('contactId') ?? undefined;
        return sendJson(response, 200, { traces: traces.listTraces({ contactId }), gate: traces.gateSnapshot(config) });
      }

      if (request.method === 'POST' && pathname === '/api/sbtpg/traces') {
        const body = await readBody(request);
        try {
          const trace = traces.trackReport(body);
          if (body.contactId && crm.findContact(body.contactId)) {
            const phrase = phraseForEro('ERO-INTERNAL-TRACE', {
              traceId: trace.id,
              productCode: trace.productCode ?? 'n/a',
              stage: trace.stage,
              clientName: crm.findContact(body.contactId).name,
              taxpayerRef: body.taxpayerRef ?? crm.findContact(body.contactId).taxpayerRef,
              detail: trace.detail
            });
            crm.logInteraction({
              contactId: body.contactId,
              type: 'sbtpg-trace',
              channel: 'ero',
              subject: `SBTPG ${trace.stage}`,
              body: phrase.text,
              relatedTraceId: trace.id
            });
          }
          return sendJson(response, 201, { trace });
        } catch (error) {
          return sendJson(response, 400, { error: 'trace_failed', message: error.message });
        }
      }

      const traceMatch = pathname.match(/^\/api\/sbtpg\/traces\/([^/]+)(?:\/(events))?$/);
      if (traceMatch) {
        const id = decodeURIComponent(traceMatch[1]);
        const trace = traces.findTrace(id);
        if (!trace) return sendJson(response, 404, { error: 'trace_not_found', id });
        if (request.method === 'GET' && !traceMatch[2]) return sendJson(response, 200, { trace });
        if (request.method === 'POST' && traceMatch[2] === 'events') {
          const body = await readBody(request);
          try {
            return sendJson(response, 200, { trace: traces.appendEvent(id, body) });
          } catch (error) {
            return sendJson(response, 400, { error: 'event_failed', message: error.message });
          }
        }
      }

      // ── Client master file + ERO status matrix ───────────
      if (request.method === 'GET' && pathname === '/api/masterfile') {
        const q = url.searchParams.get('q') ?? '';
        const letter = url.searchParams.get('letter') ?? '';
        const limit = Number(url.searchParams.get('limit') ?? 200);
        return sendJson(response, 200, {
          ...describeClientMasterfile(),
          ...masterfile.list({ q, letter, limit, sort: 'alpha' })
        });
      }

      if (request.method === 'GET' && pathname === '/api/masterfile/lookup') {
        const name = url.searchParams.get('name') ?? url.searchParams.get('q') ?? '';
        const ref = url.searchParams.get('taxpayerRef') ?? '';
        if (ref) {
          const row = masterfile.findByTaxpayerRef(ref);
          return sendJson(response, 200, { matches: row ? [row] : [], by: 'taxpayerRef' });
        }
        return sendJson(response, 200, { matches: masterfile.lookupByName(name), by: 'name' });
      }

      if (request.method === 'POST' && pathname === '/api/masterfile') {
        const body = await readBody(request);
        try {
          if (body.syncFromCrm) {
            const result = masterfile.syncFromCrm(crm);
            return sendJson(response, 200, { ...result, listing: masterfile.list({ sort: 'alpha' }) });
          }
          if (body.pipeline) {
            const ingested = masterfile.ingestApprovedRecord(body);
            return sendJson(response, 201, ingested);
          }
          const record = masterfile.upsert(body);
          return sendJson(response, 201, { record });
        } catch (error) {
          return sendJson(response, 400, { error: 'masterfile_failed', message: error.message });
        }
      }

      if (request.method === 'GET' && pathname === '/api/ero/matrix') {
        const q = url.searchParams.get('q') ?? '';
        const letter = url.searchParams.get('letter') ?? '';
        const limit = Number(url.searchParams.get('limit') ?? 200);
        const matrix = buildEroClientStatusMatrix({
          masterfile,
          crmStore: crm,
          refundCases: refunds.listCases({ limit: 1000 }),
          traces: traces.listTraces({ limit: 1000 }),
          q,
          letter,
          limit
        });
        return sendJson(response, 200, matrix);
      }

      if (serveDesignSystemAsset(response, request.url || pathname)) return;

      if (request.method === 'GET') return serveStatic(response, pathname);
      sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
    } catch (error) {
      sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });

  return { server, config, crm, pos, traces, refunds, masterfile, sync, seed };
}

export function start() {
  const context = createPosCrmServer();
  context.server.listen(context.config.servicePort, () => {
    console.log(`pos-crm-service listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`);
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
