export default {
  route: '/signin',
  title: 'Sign in',
  description: 'Sign in to your RTPSC platform account.',

  getServerData({ auth, url }) {
    const next = url.searchParams.get('next') || '/account';
    return { auth, next };
  },

  render(data) {
    if (data.auth?.enabled) {
      return `      <section class="form-card">
        <p class="eyebrow">Managed identity</p>
        <h1>Secure sign in</h1>
        <p class="lede">Continue through the configured Amazon Cognito login. This page does not collect or store your password.</p>
        ${data.auth.configured
          ? `<a class="cta-btn block" href="/auth/login?next=${encodeURIComponent(data.next)}">Continue to secure sign in</a>`
          : '<p class="status blocked">Authentication is blocked until the required Cognito configuration is complete.</p>'}
      </section>`;
    }
    return `      <section class="form-card">
        <p class="eyebrow">Signal Era access</p>
        <h1>Development sign in</h1>
        <p class="lede">Local Secure Registration &amp; Identity credentials are enabled only for the development authentication mode.</p>
        <form class="stack-form" method="post" action="/api/signin" data-api="/api/signin" data-redirect="/account">
          <label>Email<input type="email" name="email" required="required" autocomplete="username" placeholder="you@example.com" /></label>
          <label>Password<input type="password" name="password" required="required" autocomplete="current-password" placeholder="Your password" /></label>
          <button class="cta-btn block" type="submit">Sign in</button>
        </form>
        <p class="form-alt">No development account yet? <a href="/register">Create one</a>.</p>
      </section>`;
  }
};
