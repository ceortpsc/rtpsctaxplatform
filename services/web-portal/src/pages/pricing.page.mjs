import { esc } from '../layout.mjs';
import { TIERS } from '../content.mjs';

export default {
  route: '/pricing',
  title: 'Pricing',
  description: 'Membership tiers for the RTPSC tax platform.',

  render() {
    const tiers = TIERS.map((tier) => {
      const highlights = tier.highlights.map((item) => `<li>${esc(item)}</li>`).join('\n            ');
      return `<article class="tier${tier.featured ? ' tier-featured' : ''}">
          ${tier.featured ? '<span class="tier-badge">Most popular</span>' : ''}
          <h3>${esc(tier.name)}</h3>
          <p class="tier-price">${esc(tier.price)} <span>${esc(tier.cadence)}</span></p>
          <ul class="tier-list">
            ${highlights}
          </ul>
          <a class="cta-btn" href="/register?tier=${esc(tier.key)}">${esc(tier.cta)}</a>
        </article>`;
    }).join('\n        ');

    return `      <section class="page-head">
        <h1>Simple, transparent pricing</h1>
        <p class="lede">Start free for local development. Upgrade for client credentials,
        refund intelligence, and bank products.</p>
      </section>
      <section class="tiers">
        ${tiers}
      </section>`;
  }
};
