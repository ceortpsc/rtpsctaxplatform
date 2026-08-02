import { esc } from '../layout.mjs';
import { TIERS } from '../content.mjs';

export default {
  route: '/register',
  title: 'Register',
  description: 'Create a Secure Registration & Identity account for the RTPSC platform.',

  getServerData(ctx) {
    const tier = ctx.url.searchParams.get('tier');
    return { tier: TIERS.some((item) => item.key === tier) ? tier : 'starter', auth: ctx.auth };
  },

  render(data) {
    if (data.auth?.enabled) {
      return `      <section class="form-card">
        <p class="eyebrow">Managed enrollment</p>
        <h1>Create or access your secure identity</h1>
        <p class="lede">Account creation and sign-in are managed by Amazon Cognito. The RTPSC portal never receives your Cognito password.</p>
        ${data.auth.configured
          ? '<a class="cta-btn block" href="/auth/login?next=%2Faccount">Continue to secure enrollment</a>'
          : '<p class="status blocked">Enrollment is blocked until Cognito configuration is complete.</p>'}
      </section>`;
    }

    const options = TIERS.map(
      (tier) => `<option value="${esc(tier.key)}"${tier.key === data.tier ? ' selected="selected"' : ''}>${esc(tier.name)} (${esc(tier.price)})</option>`
    ).join('\n              ');
    return `      <section class="form-card">
        <p class="eyebrow">Signal Era enrollment</p>
        <h1>Create a development account</h1>
        <p class="lede">Local registration is available only when <code>PORTAL_AUTH_MODE=local</code>. Passwords are scrypt-hashed and nothing is transmitted to the IRS.</p>
        <form class="stack-form" method="post" action="/api/register" data-api="/api/register" data-redirect="/account">
          <label>Full name<input type="text" name="name" autocomplete="name" /></label>
          <label>Firm / organization<input type="text" name="org" autocomplete="organization" /></label>
          <label>Email<input type="email" name="email" required="required" autocomplete="username" /></label>
          <label>Password<input type="password" name="password" required="required" autocomplete="new-password" minlength="8" /></label>
          <label>Membership tier<select name="tier">${options}</select></label>
          <button class="cta-btn block" type="submit">Create development account</button>
        </form>
        <p class="form-alt">Already registered? <a href="/signin">Sign in</a>.</p>
      </section>`;
  }
};
