import { esc } from '../layout.mjs';

export default {
  route: '/account',
  title: 'Account',
  description: 'Your RTPSC platform account and registered EFIN providers.',

  getServerData(ctx) {
    if (!ctx.session?.ok) return { authed: false, providers: [] };
    const providers = ctx.services.efin.list({ accountId: ctx.session.account.id });
    return { authed: true, account: ctx.session.account, providers };
  },

  render(data) {
    if (!data.authed) {
      return `      <section class="form-card">
        <h1>Account</h1>
        <p class="lede">You are not signed in.</p>
        <div class="hero-cta">
          <a class="cta-btn" href="/signin">Sign in</a>
          <a class="ghost-btn" href="/register">Create an account</a>
        </div>
      </section>`;
    }

    const account = data.account;
    const providerRows = data.providers.length
      ? data.providers
          .map((provider) => {
            const verified = provider.applicationSummary?.verified;
            const badge = provider.applicationSummary
              ? `<span class="pill ${verified ? 'pill-active' : 'pill-suspended'}">${verified ? '✓ verified' : 'unverified'}</span>`
              : '<span class="muted">—</span>';
            return `<tr>
            <td><code>${esc(provider.efinMasked)}</code></td>
            <td>${esc(provider.firmName)}</td>
            <td>${esc(provider.providerTypes.join(', '))}</td>
            <td><span class="pill pill-${esc(provider.status)}">${esc(provider.status)}</span></td>
            <td>${badge}</td>
          </tr>`;
          })
          .join('\n          ')
      : `<tr><td colspan="5" class="muted">No EFIN providers registered yet.</td></tr>`;

    return `      <section class="page-head">
        <h1>Welcome, ${esc(account.name)}</h1>
        <p class="lede">${esc(account.email)} · tier <strong>${esc(account.tier)}</strong>${account.org ? ` · ${esc(account.org)}` : ''}</p>
        <div class="hero-cta">
          <a class="cta-btn" href="/efin">Register an EFIN</a>
          <button class="ghost-btn" type="button" data-signout="true">Sign out</button>
        </div>
      </section>
      <section class="panel">
        <h2>Your EFIN providers</h2>
        <table class="data-table">
          <thead><tr><th>EFIN</th><th>Firm</th><th>Roles</th><th>Status</th><th>Summary</th></tr></thead>
          <tbody>
          ${providerRows}
          </tbody>
        </table>
      </section>`;
  }
};
