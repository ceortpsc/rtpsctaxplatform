import { esc } from '../layout.mjs';

export default {
  route: '/signin',
  title: 'Sign in',
  description: 'Sign in to your RTPSC platform account.',

  render() {
    return `      <section class="form-card">
        <h1>Sign in</h1>
        <p class="lede">Welcome back. Enter your Secure Registration &amp; Identity credentials.</p>
        <form class="stack-form" method="post" action="/api/signin" data-api="/api/signin" data-redirect="/account">
          <label>Email
            <input type="email" name="email" required="required" autocomplete="username" placeholder="you@example.com" />
          </label>
          <label>Password
            <input type="password" name="password" required="required" autocomplete="current-password" placeholder="Your password" />
          </label>
          <button class="cta-btn block" type="submit">Sign in</button>
        </form>
        <p class="form-alt">No account yet? <a href="/register">Create one</a>.</p>
      </section>`;
  }
};
