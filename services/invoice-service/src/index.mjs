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
import {
  assistDataEntry,
  approveInvoice,
  createInvoice,
  exportInvoicePdf,
  exportReceiptPdf,
  exportReceiptText,
  listServiceCatalog,
  recordPayment,
  submitForApproval,
  taxLookups
} from '../../../packages/invoice-core/src/index.mjs';
import { servePublicOrShared, sendNotFoundPage, sendDesignSystemPage } from '../../../packages/ui-system/src/serve.mjs';
import { buildOperationalSeed, loadFirmIdentity, resolveServiceWiring } from '../../../packages/operational-seed/src/index.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEFAULT_PORT = 3005;

export const invoiceDescriptor = createServiceDescriptor({
  name: 'invoice-service',
  domain: 'operations',
  responsibilities: [
    'Run the invoicing machine for tax-prep operations (create, approve, pay).',
    'AI-assisted data entry with state and county/parish tax calculations.',
    'Generate payment confirmations and export invoices/receipts to PDF and receipt paper.'
  ],
  dependencies: ['@rtp/invoice-core', '@rtp/tax-data']
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
    return sendDesignSystemPage(response, { serviceName: 'Invoices', homeHref: '/' });
  }
  if (await servePublicOrShared(response, urlPath, publicDir)) return;
  const looksHtml = !path.extname(urlPath) || urlPath.endsWith('.html');
  if (looksHtml) return sendNotFoundPage(response);
  sendJson(response, 404, { error: 'not_found', path: urlPath });
}

function findInvoice(store, id) {
  return store.find((inv) => inv.id === id) ?? null;
}

function replaceInvoice(store, updated) {
  const idx = store.findIndex((inv) => inv.id === updated.id);
  if (idx >= 0) store[idx] = updated;
  else store.unshift(updated);
  return updated;
}

export function createInvoiceServer() {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const invoices = [];
  const firm = loadFirmIdentity();
  const operational = buildOperationalSeed();
  const wiring = resolveServiceWiring();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { status: 'ok', service: invoiceDescriptor.name, environment: config.appEnv });
      }

      if (request.method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: invoiceDescriptor,
          runtime: redactConfig(config),
          environmentProtection: evaluateEnvironmentProtection(config),
          metadata: {
            invoices: invoices.length,
            catalogItems: listServiceCatalog().length,
            firm: {
              company: firm.company,
              operator: firm.operator?.name ?? null,
              completeness: firm.completeness
            },
            wiring: {
              posCrm: wiring.byId['pos-crm-service']?.baseUrl,
              enrollment: wiring.byId['enrollment-service']?.baseUrl
            }
          }
        });
      }

      if (request.method === 'GET' && pathname === '/api/operational') {
        return sendJson(response, 200, {
          firm,
          catalogs: operational.catalogs,
          wiring: wiring.services
        });
      }

      if (request.method === 'GET' && pathname === '/api/catalog') {
        return sendJson(response, 200, { catalog: listServiceCatalog() });
      }

      if (request.method === 'GET' && pathname === '/api/tax') {
        return sendJson(response, 200, taxLookups());
      }

      if (request.method === 'POST' && pathname === '/api/assist') {
        const body = await readBody(request);
        return sendJson(response, 200, { assist: assistDataEntry(body) });
      }

      if (request.method === 'GET' && pathname === '/api/invoices') {
        return sendJson(response, 200, { count: invoices.length, invoices });
      }

      if (request.method === 'POST' && pathname === '/api/invoices') {
        const body = await readBody(request);
        try {
          const invoice = createInvoice(body);
          invoices.unshift(invoice);
          if (invoices.length > 300) invoices.length = 300;
          return sendJson(response, 201, { invoice });
        } catch (error) {
          return sendJson(response, 400, { error: 'invalid_invoice', message: error.message });
        }
      }

      const invMatch = pathname.match(/^\/api\/invoices\/([^/]+)(?:\/(submit|approve|pay|pdf|receipt\.pdf|receipt\.txt))?$/);
      if (invMatch) {
        const id = decodeURIComponent(invMatch[1]);
        const action = invMatch[2] ?? null;
        const invoice = findInvoice(invoices, id);
        if (!invoice) return sendJson(response, 404, { error: 'invoice_not_found', id });

        if (request.method === 'GET' && !action) {
          return sendJson(response, 200, { invoice });
        }

        if (request.method === 'POST' && action === 'submit') {
          try {
            const updated = replaceInvoice(invoices, submitForApproval(invoice));
            return sendJson(response, 200, { invoice: updated });
          } catch (error) {
            return sendJson(response, 400, { error: 'submit_failed', message: error.message });
          }
        }

        if (request.method === 'POST' && action === 'approve') {
          const body = await readBody(request);
          try {
            const updated = replaceInvoice(invoices, approveInvoice(invoice, { approver: body.approver ?? 'operator' }));
            return sendJson(response, 200, { invoice: updated });
          } catch (error) {
            return sendJson(response, 400, { error: 'approve_failed', message: error.message });
          }
        }

        if (request.method === 'POST' && action === 'pay') {
          const body = await readBody(request);
          try {
            const updated = replaceInvoice(invoices, recordPayment(invoice, body));
            return sendJson(response, 200, { invoice: updated, confirmation: updated.confirmation });
          } catch (error) {
            return sendJson(response, 400, { error: 'payment_failed', message: error.message });
          }
        }

        if (request.method === 'GET' && action === 'pdf') {
          const pdf = exportInvoicePdf(invoice);
          return sendBinary(response, 200, pdf, 'application/pdf', `${invoice.number}.pdf`);
        }

        if (request.method === 'GET' && action === 'receipt.pdf') {
          const pdf = exportReceiptPdf(invoice);
          return sendBinary(response, 200, pdf, 'application/pdf', `${invoice.number}-receipt.pdf`);
        }

        if (request.method === 'GET' && action === 'receipt.txt') {
          const text = Buffer.from(exportReceiptText(invoice), 'utf8');
          return sendBinary(response, 200, text, 'text/plain; charset=utf-8', `${invoice.number}-receipt.txt`);
        }
      }

      if (request.method === 'GET') return serveStatic(response, pathname);

      sendJson(response, 405, { error: 'method_not_allowed', method: request.method, path: pathname });
    } catch (error) {
      sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });

  return { server, config, invoices };
}

export function start() {
  const context = createInvoiceServer();
  context.server.listen(context.config.servicePort, () => {
    console.log(`invoice-service listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`);
  });
  return context;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start();
}
