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
    const features = FEATURES.slice(0, 3)
      .map(
        (feature) =>
          `<li><h3>${esc(feature.title)}</h3><p>${esc(feature.body)}</p></li>`
      )
      .join('\n          ');
    const primary = data.session?.ok
      ? '<a class="cta-btn" href="/account">Open secure workspace</a>'
      : data.auth?.enabled
        ? data.auth.configured
          ? '<a class="cta-btn" href="/auth/login?next=%2Faccount">Sign in with Cognito</a>'
          : '<span class="status blocked">Identity configuration required</span>'
        : '<a class="cta-btn" href="/register">Create your account</a>';

    return `      <section class="hero-plane" aria-label="Brand hero">
        <div class="hero-plane__inner">
          <p class="hero-brand">${esc(SITE.short)}</p>
          <h1 class="hero-headline">${esc(SITE.product)}</h1>
          <p class="hero-lede">${esc(SITE.tagline)}</p>
          <div class="hero-cta">
            ${primary}
            <a class="ghost-btn" href="/platform">Explore the platform</a>
            ${data.session?.ok ? '<a class="ghost-btn" href="/client-import">Secure client import</a>' : ''}
          </div>
        </div>
      </section>
      <section class="section-band" aria-label="Platform highlights">
        <h2>Built for the next transmission era</h2>
        <p>Operator tooling, refund intelligence, and e-file infrastructure in one signal-clear stack.</p>
        <ul class="feature-list">${features}</ul>
      </section>
      <section class="access-band">
        <h2>Identity-gated practitioner access</h2>
        <p>EFIN onboarding, account records, and client imports require an authenticated portal session. Public pages never collect taxpayer records or practitioner credentials.</p>
        ${data.session?.ok ? '<a class="cta-btn" href="/efin">Manage EFIN onboarding</a>' : primary}
      </section>`;
  }
};
