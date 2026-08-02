import { esc } from '../layout.mjs';
import { pageIntro } from '../presentations.mjs';

export default {
  route: '/client-import',
  title: 'Secure client import',
  description: 'Authenticated client-import preparation, messaging, validation controls, and approval workflow.',

  getServerData({ session, services, config }) {
    const account = session?.ok ? session.account : null;
    const portalUrl = `${config.publicBaseUrl || ''}/client-import` || '/client-import';
    return {
      account,
      message: services.clientImport.buildMessage({
        firmName: account?.org || 'Ross Tax Pro Software Co',
        recipientName: 'Client',
        portalUrl
      }),
      sources: services.clientImport.sourceTypes
    };
  },

  render(data) {
    const sourceOptions = data.sources.map((source) => `<option value="${esc(source)}">${esc(source)}</option>`).join('');
    return `${pageIntro({
      title: 'Secure client import',
      lede: 'Prepare an import request without placing taxpayer data in email, text messages, screenshots, or public files.'
    })}
      <div class="grid-2">
        <section class="form-card">
          <p class="eyebrow">Transfer control</p>
          <h2>Import readiness gate</h2>
          <form class="stack-form" action="/api/client-import/evaluate" method="post" data-api-form="client-import">
            <label>Source type
              <select id="sourceType" name="sourceType" required="required">${sourceOptions}</select>
            </label>
            <label>Expected records
              <input id="recordCount" name="recordCount" type="number" min="1" max="10000" required="required" />
            </label>
            <label class="check">
              <input name="taxpayerConsent" type="checkbox" value="true" />
              <span>Taxpayer consent or lawful firm authority is documented</span>
            </label>
            <label class="check">
              <input name="encryptedTransfer" type="checkbox" value="true" />
              <span>Transfer will use the authenticated encrypted portal</span>
            </label>
            <button class="cta-btn block" type="submit">Evaluate import</button>
          </form>
          <p class="muted small">A READY result authorizes secure upload preparation only. It does not import records automatically.</p>
        </section>
        <section class="panel">
          <h2>Client-facing secure message</h2>
          <form class="stack-form">
            <label>Copy for client outreach
              <textarea rows="15" readonly="readonly">${esc(data.message)}</textarea>
            </label>
          </form>
          <p class="status limited">Taxpayer files remain validation-only until malware scanning, schema checks, duplicate detection, and human approval pass.</p>
        </section>
      </div>`;
  }
};
