import { esc } from '../layout.mjs';

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
    return `      <section class="hero compact">
        <p class="eyebrow">Authenticated transfer control</p>
        <h1>Secure client import</h1>
        <p class="lede">Prepare an import request without placing taxpayer data in email, text messages, screenshots, or public files.</p>
      </section>
      <section class="grid two-col">
        <article class="card">
          <h2>Import readiness gate</h2>
          <form action="/api/client-import/evaluate" method="post" data-api-form="client-import">
            <label for="sourceType">Source type</label>
            <select id="sourceType" name="sourceType" required="required">${sourceOptions}</select>
            <label for="recordCount">Expected records</label>
            <input id="recordCount" name="recordCount" type="number" min="1" max="10000" required="required" />
            <label><input name="taxpayerConsent" type="checkbox" value="true" /> Taxpayer consent or lawful firm authority is documented</label>
            <label><input name="encryptedTransfer" type="checkbox" value="true" /> Transfer will use the authenticated encrypted portal</label>
            <button class="cta-btn" type="submit">Evaluate import</button>
          </form>
          <p class="muted">A READY result authorizes secure upload preparation only. It does not import records automatically.</p>
        </article>
        <article class="card">
          <h2>Client-facing secure message</h2>
          <textarea rows="15" readonly="readonly">${esc(data.message)}</textarea>
          <p class="status limited">Taxpayer files remain validation-only until malware scanning, schema checks, duplicate detection, and human approval pass.</p>
        </article>
      </section>`;
  }
};
