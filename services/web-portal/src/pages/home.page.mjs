import { esc } from '../layout.mjs';
import { SITE, FEATURES } from '../content.mjs';

export default {
  route: '/',
  title: 'Home',
  description: `${SITE.name} — ${SITE.tagline}`,

  render() {
    const cards = FEATURES.slice(0, 3)
      .map(
        (feature) => `<article class="card">
          <h3>${esc(feature.title)}</h3>
          <p>${esc(feature.body)}</p>
        </article>`
      )
      .join('\n        ');

    return `      <section class="hero">
        <p class="eyebrow">${esc(SITE.name)}</p>
        <h1>${esc(SITE.product)}</h1>
        <p class="lede">${esc(SITE.tagline)}</p>
        <div class="hero-cta">
          <a class="cta-btn" href="/register">Create your account</a>
          <a class="ghost-btn" href="/platform">Explore the platform</a>
          <a class="ghost-btn" href="/efin">Register an EFIN</a>
        </div>
      </section>
      <section class="cards" aria-label="Highlights">
        ${cards}
      </section>
      <section class="callout">
        <h2>Authorized e-file provider ready</h2>
        <p>Onboard your firm's EFIN through Secure Registration &amp; Identity (SRI), then
        manage refunds, invoicing, POS, and bank products from one operator surface.</p>
        <a class="cta-btn" href="/efin">Start EFIN onboarding</a>
      </section>`;
  }
};
