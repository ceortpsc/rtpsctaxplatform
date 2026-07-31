import { esc } from '../layout.mjs';
import { SITE, FEATURES } from '../content.mjs';

export default {
  route: '/',
  title: 'Home',
  description: `${SITE.name} — ${SITE.tagline}`,

  getServerData({ session, auth }) {
    return { session, auth };
  },

  render(data) {
    const cards = FEATURES.slice(0, 3)
      .map((feature) => `<article class="card"><h3>${esc(feature.title)}</h3><p>${esc(feature.body)}</p></article>`)
      .join('\n        ');
    const primary = data.session?.ok
      ? '<a class="cta-btn" href="/account">Open secure workspace</a>'
      : data.auth?.enabled
        ? data.auth.configured
          ? '<a class="cta-btn" href="/auth/login?next=%2Faccount">Sign in with Cognito</a>'
          : '<span class="status blocked">Identity configuration required</span>'
        : '<a class="cta-btn" href="/register">Create your account</a>';

    return `      <section class="hero">
        <p class="eyebrow">${esc(SITE.name)}</p>
        <h1>${esc(SITE.product)}</h1>
        <p class="lede">${esc(SITE.tagline)}</p>
        <div class="hero-cta">
          ${primary}
          <a class="ghost-btn" href="/platform">Explore the platform</a>
          ${data.session?.ok ? '<a class="ghost-btn" href="/client-import">Secure client import</a>' : ''}
        </div>
      </section>
      <section class="cards" aria-label="Highlights">${cards}</section>
      <section class="callout">
        <h2>Identity-gated practitioner access</h2>
        <p>EFIN onboarding, account records, and client imports require an authenticated portal session. Public pages never collect taxpayer records or practitioner credentials.</p>
        ${data.session?.ok ? '<a class="cta-btn" href="/efin">Manage EFIN onboarding</a>' : primary}
      </section>`;
  }
};
