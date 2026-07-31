import { esc } from '../layout.mjs';
import { accessBand, featureRows } from '../presentations.mjs';
import { SITE, FEATURES } from '../content.mjs';

export default {
  route: '/',
  title: 'Home',
  description: `${SITE.name} — ${SITE.tagline}`,

  getServerData({ session, auth }) {
    return { session, auth };
  },

  render(data) {
    const primary = data.session?.ok
      ? '<a class="cta-btn" href="/account">Open secure workspace</a>'
      : data.auth?.enabled
        ? data.auth.configured
          ? '<a class="cta-btn" href="/auth/login?next=%2Faccount">Sign in with Cognito</a>'
          : '<span class="status blocked">Identity configuration required</span>'
        : '<a class="cta-btn" href="/register">Create your account</a>';

    const features = featureRows(
      FEATURES.slice(0, 3).map((feature) => ({
        title: feature.title,
        body: feature.body
      }))
    );

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
        ${features}
      </section>
${accessBand({
  title: 'Identity-gated practitioner access',
  lede: 'EFIN onboarding, account records, and client imports require an authenticated portal session. Public pages never collect taxpayer records or practitioner credentials.',
  actions: data.session?.ok
    ? '<a class="cta-btn" href="/efin">Manage EFIN onboarding</a>'
    : primary
})}`;
  }
};
