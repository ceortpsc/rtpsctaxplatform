import http from 'node:http';
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
import { servePublicOrShared, sendNotFoundPage, sendDesignSystemPage } from '../../../packages/ui-system/src/serve.mjs';
import {
  applyOperationalSeed,
  buildOperationalSeed,
  hydrateCrmFromSnapshot,
  loadFirmIdentity,
  readJsonFile,
  resolveOperationalDataDir,
  resolveServiceWiring
} from '../../../packages/operational-seed/src/index.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3006;

export const posCrmDescriptor = createServiceDescriptor({
  name: 'pos-crm-service',
  domain: 'operations',
  responsibilities: [
    'Operate the CRM for tax-prep clients (contacts, accounts, interactions).',
    'Run the Point of Sale register fully linked to CRM and the invoicing machine.',
    'Track SBTPG report traces, automate ERO phrasing, and surface refund intelligence.'
  ],
  dependencies: ['@rtp/crm-core', '@rtp/pos-core', '@rtp/ero-ops', '@rtp/invoice-core', '@rtp/tax-data', '@rtp/bank-products']
});

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
  if (urlPath === '/design-system') {
    return sendDesignSystemPage(response, { serviceName: 'POS + CRM', homeHref: '/' });
  }
  if (await servePublicOrShared(response, urlPath, publicDir)) return;
  const looksHtml = !path.extname(urlPath) || urlPath.endsWith('.html');
  if (looksHtml) return sendNotFoundPage(response);
  sendJson(response, 404, { error: 'not_found', path: urlPath });
}

export function createPosCrmServer() {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const crm = createCrmStore();
  const pos = createPosStore(crm);
  const traces = createSbtpgTraceStore();
  const firm = loadFirmIdentity();
  const operational = buildOperationalSeed();
  const wiring = resolveServiceWiring();
  let seedApplied = null;
  let seedReady = false;

  async function ensureOperationalSeed() {
    if (seedReady) return seedApplied;
    const snapshotPath = path.join(resolveOperationalDataDir(), 'crm-snapshot.json');
    const snapshot = await readJsonFile(snapshotPath, null);
    if (snapshot?.kind === 'crm-snapshot') {
      hydrateCrmFromSnapshot(crm, snapshot);
      seedApplied = {
        source: 'crm-snapshot',
        firmAccountId: crm.listAccounts().find((a) => a.type === 'firm')?.id ?? null,
        operatorContactId: crm.searchContacts('', { limit: 50 }).find((c) => c.tags?.includes('operator'))?.id ?? null
      };
    } else {
      seedApplied = await applyOperationalSeed({ crm, seedRefunds: false });
    }
    seedReady = true;
    return seedApplied;
  }

  const server = http.createServer(async (request, response) => {
    await ensureOperationalSeed();
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
            firm: {
              company: firm.company,
              operator: firm.operator?.name ?? null,
              registerId: firm.pos.registerId,
              completeness: firm.completeness
            },
            operationalSeed: seedApplied,
            wiring: {
              invoice: wiring.byId['invoice-service']?.baseUrl,
              enrollment: wiring.byId['enrollment-service']?.baseUrl,
              refund: wiring.byId['refund-status-service']?.baseUrl
            },
            catalogSkus: operational.catalogs.counts.serviceCatalog
          }
        });
      }

      if (request.method === 'GET' && pathname === '/api/operational') {
        return sendJson(response, 200, {
          firm,
          seed: seedApplied,
          wiring: wiring.services,
          catalogs: operational.catalogs.counts
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
        return sendJson(response, 200, { contacts: crm.searchContacts(q) });
      }

      if (request.method === 'POST' && pathname === '/api/contacts') {
        const body = await readBody(request);
        try {
          const contact = crm.createContact(body);
          return sendJson(response, 201, { contact });
        } catch (error) {
          return sendJson(response, 400, { error: 'invalid_contact', message: error.message });
        }
      }

      const contactMatch = pathname.match(/^\/api\/contacts\/([^/]+)(?:\/(interactions))?$/);
      if (contactMatch) {
        const id = decodeURIComponent(contactMatch[1]);
        const contact = crm.findContact(id);
        if (!contact) return sendJson(response, 404, { error: 'contact_not_found', id });

        if (request.method === 'GET' && !contactMatch[2]) {
          return sendJson(response, 200, {
            contact,
            account: contact.accountId ? crm.findAccount(contact.accountId) : null,
            interactions: crm.listInteractions(id),
            sales: pos.listSales({ contactId: id }),
            traces: traces.listTraces({ contactId: id })
          });
        }

        if (request.method === 'PATCH' && !contactMatch[2]) {
          const body = await readBody(request);
          try {
            return sendJson(response, 200, { contact: crm.updateContact(id, body) });
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

      if (request.method === 'GET') return serveStatic(response, pathname);
      sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
    } catch (error) {
      sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });

  return { server, config, crm, pos, traces, firm, ensureOperationalSeed, getSeed: () => seedApplied };
}

export function start() {
  const context = createPosCrmServer();
  context.server.listen(context.config.servicePort, async () => {
    await context.ensureOperationalSeed();
    console.log(`pos-crm-service listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`);
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
