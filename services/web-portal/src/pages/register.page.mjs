import { esc } from '../layout.mjs';
import { TIERS } from '../content.mjs';

export default {
  route: '/register',
  title: 'Register',
  description: 'Create a Secure Registration & Identity (SRI) account for the RTPSC platform.',

  getServerData(ctx) {
    const tier = ctx.url.searchParams.get('tier');
    return { tier: TIERS.some((t) => t.key === tier) ? tier : 'starter' };
  },

  render(data) {
    const options = TIERS.map(
      (tier) => `<option value="${esc(tier.key)}"${tier.key === data.tier ? ' selected="selected"' : ''}>${esc(tier.name)} (${esc(tier.price)})</option>`
    ).join('\n              ');

    return `      <section class="form-card">
        <h1>Create your account</h1>
        <p class="lede">Secure Registration &amp; Identity (SRI). Passwords are hashed with
        scrypt; nothing is transmitted to the IRS at this step.</p>
        <form class="stack-form" method="post" action="/api/register" data-api="/api/register" data-redirect="/account">
          <label>Full name
            <input type="text" name="name" autocomplete="name" placeholder="Jordan Ellis" />
          </label>
          <label>Firm / organization
            <input type="text" name="org" autocomplete="organization" placeholder="Ross Tax Pro" />
          </label>
          <label>Email
            <input type="email" name="email" required="required" autocomplete="username" placeholder="you@example.com" />
          </label>
          <label>Password
            <input type="password" name="password" required="required" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" />
          </label>
          <label>Membership tier
            <select name="tier">
              ${options}
            </select>
          </label>
          <button class="cta-btn block" type="submit">Create account</button>
        </form>
        <p class="form-alt">Already registered? <a href="/signin">Sign in</a>.</p>
      </section>`;
  }
};
