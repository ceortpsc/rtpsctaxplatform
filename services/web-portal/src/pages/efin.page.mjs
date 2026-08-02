import { esc } from '../layout.mjs';
import { pageIntro } from '../presentations.mjs';
import { PROVIDER_TYPES } from '../../../../packages/sri-efin/src/index.mjs';

const TYPE_LABELS = {
  ero: 'Electronic Return Originator (ERO)',
  transmitter: 'Transmitter',
  'software-developer': 'Software Developer',
  'reporting-agent': 'Reporting Agent',
  'intermediate-service-provider': 'Intermediate Service Provider'
};

export default {
  route: '/efin',
  title: 'EFIN onboarding',
  description: 'Register an IRS EFIN provider identity via Secure Registration & Identity (SRI).',

  getServerData(ctx) {
    const accountId = ctx.session?.ok ? ctx.session.account.id : undefined;
    return {
      authed: Boolean(ctx.session?.ok),
      providers: ctx.services.efin.list(accountId ? { accountId } : {})
    };
  },

  render(data) {
    const typeChecks = PROVIDER_TYPES.map(
      (type) => `<label class="check">
              <input type="checkbox" name="providerTypes" value="${esc(type)}"${type === 'ero' ? ' checked="checked"' : ''} />
              <span>${esc(TYPE_LABELS[type] ?? type)}</span>
            </label>`
    ).join('\n            ');

    const rows = data.providers.length
      ? data.providers
          .map(
            (provider) => `<tr>
            <td><code>${esc(provider.efinMasked)}</code></td>
            <td>${esc(provider.firmName)}</td>
            <td>${esc(provider.providerTypes.join(', '))}</td>
            <td><span class="pill pill-${esc(provider.status)}">${esc(provider.status)}</span></td>
          </tr>`
          )
          .join('\n          ')
      : `<tr><td colspan="4" class="muted">No EFIN providers registered yet.</td></tr>`;

    return `${pageIntro({
      title: 'EFIN onboarding',
      lede: 'Secure Registration &amp; Identity (SRI) for IRS Authorized e-file Providers. This scaffold validates and records provider identity; it does not contact the IRS. EFINs are stored masked.'
    })}
      <div class="grid-2">
        <section class="form-card">
          <h2>Register a provider</h2>
          <form class="stack-form" method="post" action="/api/efin" data-api="/api/efin" data-redirect="/efin" data-array="providerTypes">
            <label>EFIN (6 digits)
              <input type="text" name="efin" required="required" inputmode="numeric" pattern="\\d{6}" placeholder="123456" />
            </label>
            <label>ETIN (5 digits, optional)
              <input type="text" name="etin" inputmode="numeric" pattern="\\d{5}" placeholder="12345" />
            </label>
            <label>Firm / organization
              <input type="text" name="firmName" required="required" placeholder="Ross Tax Pro" />
            </label>
            <fieldset class="checks">
              <legend>Provider roles</legend>
              ${typeChecks}
            </fieldset>
            <label>Responsible official name
              <input type="text" name="responsibleName" placeholder="Jordan Ellis" />
            </label>
            <label>Responsible official email
              <input type="email" name="responsibleEmail" placeholder="official@example.com" />
            </label>
            <button class="cta-btn block" type="submit">Register EFIN</button>
          </form>
          ${data.authed ? '' : '<p class="form-alt">Tip: <a href="/signin">sign in</a> to attach this EFIN to your account.</p>'}
        </section>
        <section class="panel">
          <h2>Registered providers</h2>
          <table class="data-table">
            <thead><tr><th>EFIN</th><th>Firm</th><th>Roles</th><th>Status</th></tr></thead>
            <tbody>
            ${rows}
            </tbody>
          </table>
          <p class="muted small">Lifecycle: draft → submitted → suitability-pending → active.</p>
        </section>
      </div>`;
  }
};
