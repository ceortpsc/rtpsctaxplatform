"""Shared HTML chrome and page renderers for ROSS operator console."""

from __future__ import annotations

import html
from typing import Any

from ross_ai.brand import APP_FULL_NAME, APP_NAME, COMPANY, TAGLINE
from ross_ai.seo import page_seo, render_head


def esc(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def layout(
    *,
    title: str,
    body: str,
    user: dict | None = None,
    csrf: str = "",
    nav: str = "landing",
    flash: str | None = None,
    scripts: str = "",
    description: str | None = None,
    path: str = "/",
    index: bool | None = None,
    breadcrumbs: list[tuple[str, str]] | None = None,
) -> str:
    # Authenticated / app surfaces stay out of search indexes by default
    if index is None:
        index = nav in {"landing", "marketplace", "legal", "gate"} and not user

    seo = page_seo(
        title=f"{title} · {APP_NAME}" if title != APP_NAME else f"{APP_NAME} — {APP_FULL_NAME}",
        description=description,
        path=path,
        index=index,
        breadcrumbs=breadcrumbs,
    )

    auth_links = ""
    if user:
        mem_label = esc(user.get("tierName") or "Pending membership")
        auth_links = f"""
        <a class="nav-link" href="/dashboard">Control Plane</a>
        <a class="nav-link" href="/execute">Execute</a>
        <a class="nav-link" href="/rbac">RBAC</a>
        <a class="nav-link" href="/marketplace">Marketplace</a>
        <a class="nav-link" href="/billing">Billing</a>
        <a class="nav-link" href="/users">Users</a>
        <a class="nav-link" href="/legal">Policy</a>
        <span class="nav-user">{esc(user.get('name'))} · {mem_label} · {esc(user.get('role'))}</span>
        <form class="inline" method="post" action="/logout">
          <input type="hidden" name="csrf" value="{esc(csrf)}" />
          <button type="submit" class="nav-link btn-link">Sign out</button>
        </form>
        """
    else:
        auth_links = """
        <a class="nav-link" href="/marketplace">Marketplace</a>
        <a class="nav-link" href="/legal">Disclosures</a>
        <a class="nav-link" href="/signin">Sign in</a>
        <a class="nav-cta" href="/signup">Create account</a>
        """

    flash_html = f'<div class="flash" role="status">{esc(flash)}</div>' if flash else ""
    head = render_head(seo)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
{head}
</head>
<body data-nav="{esc(nav)}" data-authed="{1 if user else 0}" data-app="{esc(APP_NAME)}">
  <div class="atmosphere" aria-hidden="true"></div>
  <header class="topbar">
    <a class="mark" href="/" aria-label="{esc(APP_FULL_NAME)} home"><strong>{esc(APP_NAME)}</strong> <em>{esc(COMPANY)}</em></a>
    <nav class="nav" aria-label="Primary">{auth_links}</nav>
  </header>
  {flash_html}
  {body}
  <footer class="site-footer">
    <div>
      <strong>{esc(APP_NAME)}</strong> — {esc(APP_FULL_NAME)}
      <span>{esc(TAGLINE)}</span>
    </div>
    <div>
      <a href="/marketplace">Marketplace</a>
      <a href="/legal">Policy</a>
      <a href="/robots.txt">robots</a>
      <a href="/sitemap.xml">sitemap</a>
    </div>
    <p>© {esc(COMPANY)}. All rights reserved. ZERO REFUNDS — ABSOLUTELY ZERO.</p>
  </footer>
  <script src="/static/app.js" defer></script>
  {scripts}
</body>
</html>
"""


def landing_page(**kwargs) -> str:
    body = f"""
<main class="hero" itemscope itemtype="https://schema.org/SoftwareApplication">
  <p class="eyebrow animate-in" itemprop="author">{esc(COMPANY)}</p>
  <h1 class="brand-hero animate-in delay-1" itemprop="name"><span class="app-mark">{esc(APP_NAME)}</span><br/><span class="app-full">{esc(APP_FULL_NAME)}</span></h1>
  <p class="lede animate-in delay-2" itemprop="description">{esc(TAGLINE)} Hardened operator control for command packages, membership, RBAC, and transparent execution.</p>
  <meta itemprop="applicationCategory" content="FinanceApplication" />
  <div class="cta-row animate-in delay-3">
    <a class="btn primary" href="/signup">Create {esc(APP_NAME)} account</a>
    <a class="btn ghost" href="/marketplace">View membership tiers</a>
    <a class="btn ghost" href="/auth/github">Continue with GitHub</a>
  </div>
  <p class="zero-banner animate-in delay-3">ZERO REFUNDS — ABSOLUTELY ZERO. All membership fees are final.</p>
</main>
<section class="presence animate-in delay-2" aria-label="Product presence">
  <h2>Built for operators who need governed runtime power</h2>
  <p>{esc(APP_NAME)} is the production control plane from {esc(COMPANY)} — not a generic dashboard template. One brand composition: packages, runtime, membership, and disciplined access.</p>
</section>
<section class="strip" aria-label="Platform pillars">
  <div><strong>Packages</strong><span>.rpkg build + checksum seal</span></div>
  <div><strong>Runtime</strong><span>Script runner + live WS feed</span></div>
  <div><strong>Membership</strong><span>Four tiers · payment on file</span></div>
  <div><strong>Policy</strong><span>Absolute zero refunds</span></div>
</section>
"""
    return layout(
        title=APP_NAME,
        body=body,
        nav="landing",
        path="/",
        index=True,
        breadcrumbs=[("Home", "/")],
        description=f"{APP_FULL_NAME} by {COMPANY}. {TAGLINE}",
        **kwargs,
    )


def gate_page(
    *,
    mode: str,
    action: str,
    heading: str,
    sub: str,
    submit: str,
    csrf: str = "",
    error: str | None = None,
    **kwargs,
) -> str:
    name_field = ""
    if mode == "signup":
        name_field = """
        <label>Name
          <input name="name" autocomplete="name" placeholder="Operator name" />
        </label>
        """
    err = f'<p class="form-error">{esc(error)}</p>' if error else ""
    alt = (
        '<p class="gate-alt">Already have access? <a href="/signin">Sign in</a></p>'
        if mode == "signup"
        else '<p class="gate-alt">Need an account? <a href="/signup">Create access</a></p>'
    )
    body = f"""
<main class="gate">
  <div class="gate-panel animate-in">
    <p class="eyebrow">Access gate</p>
    <h1>{esc(heading)}</h1>
    <p class="lede tight">{esc(sub)}</p>
    {err}
    <form method="post" action="{esc(action)}" class="gate-form">
      <input type="hidden" name="csrf" value="{esc(csrf)}" />
      {name_field}
      <label>Email
        <input type="email" name="email" required autocomplete="username" placeholder="you@rosstaxsoftware.com" />
      </label>
      <label>Password
        <input type="password" name="password" required autocomplete="{'new-password' if mode == 'signup' else 'current-password'}" minlength="10" placeholder="At least 10 characters" />
      </label>
      <button class="btn primary block" type="submit">{esc(submit)}</button>
    </form>
    <a class="btn ghost block github-btn" href="/auth/github">Continue with GitHub</a>
    {alt}
  </div>
</main>
"""
    path = "/signup" if mode == "signup" else "/signin"
    return layout(
        title=heading,
        body=body,
        nav="gate",
        csrf=csrf,
        path=path,
        index=True,
        breadcrumbs=[("Home", "/"), (heading, path)],
        description=(
            f"Create your {APP_NAME} account at {COMPANY}."
            if mode == "signup"
            else f"Sign in to {APP_NAME} — {APP_FULL_NAME}."
        ),
        **kwargs,
    )


def dashboard_page(
    *,
    inventory: dict,
    hardening: dict,
    artifacts: list,
    plans: list,
    events: list,
    ws_clients: int,
    **kwargs,
) -> str:
    sector_bits = "".join(
        f"<div class='metric'><strong>{esc(k)}</strong><span>{esc(v)}</span></div>"
        for k, v in (inventory.get("sectors") or {}).items()
    )
    event_rows = "".join(
        f"<li><code>{esc(e.get('type'))}</code> <span>{esc(e.get('message') or e.get('email') or '')}</span></li>"
        for e in events[-12:][::-1]
    ) or "<li class='muted'>Waiting for live events…</li>"
    art = "".join(f"<li>{esc(a)}</li>" for a in artifacts) or "<li class='muted'>No packages yet — run package build</li>"
    plan_list = "".join(f"<li>{esc(p)}</li>" for p in plans) or "<li class='muted'>No deploy plans yet</li>"

    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Operator console</p>
      <h1>Control plane</h1>
      <p class="lede tight">Live inventory, hardening posture, packages, and WebSocket telemetry.</p>
    </div>
    <div class="live-pill" id="ws-pill" data-state="connecting">WS · connecting</div>
  </header>

  <p class="zero-banner">ZERO REFUNDS — ABSOLUTELY ZERO. Membership charges are final.</p>

  <section class="metrics animate-in delay-1" aria-label="Inventory metrics">
    <div class="metric"><strong>{esc(inventory.get('total'))}</strong><span>modules</span></div>
    <div class="metric"><strong>{esc(inventory.get('present'))}</strong><span>present</span></div>
    <div class="metric"><strong>{esc(hardening.get('score'))}</strong><span>harden score</span></div>
    <div class="metric"><strong id="ws-count">{esc(ws_clients)}</strong><span>WS clients</span></div>
    {sector_bits}
  </section>

  <div class="grid-2 animate-in delay-2">
    <section class="panel">
      <h2>Live stream</h2>
      <ul class="feed" id="event-feed">{event_rows}</ul>
    </section>
    <section class="panel">
      <h2>Packages</h2>
      <ul class="list">{art}</ul>
      <h2 class="spaced">Deploy plans</h2>
      <ul class="list">{plan_list}</ul>
    </section>
  </div>

  <section class="panel animate-in delay-3">
    <h2>Quick actions</h2>
    <div class="action-row">
      <a class="btn ghost" href="/modules">All systems</a>
      <a class="btn ghost" href="/marketplace">Marketplace</a>
      <a class="btn ghost" href="/billing">Billing</a>
      <a class="btn ghost" href="/users">Users</a>
      <a class="btn ghost" href="/legal">Policy</a>
      <a class="btn ghost" href="/infrastructure">Infrastructure</a>
      <a class="btn ghost" href="/packages">Packages</a>
      <a class="btn ghost" href="/deploy">Deploy</a>
      <a class="btn ghost" href="/api/inventory">Inventory API</a>
    </div>
  </section>
</main>
"""
    scripts = '<script>window.ROSS_WS = true;</script>'
    return layout(title="Dashboard", body=body, nav="dashboard", scripts=scripts, **kwargs)


def catalog_page(
    *,
    title: str,
    heading: str,
    sub: str,
    items: list[dict],
    nav: str,
    **kwargs,
) -> str:
    cards = []
    for item in items:
        port = f"<span class='tag'>:{esc(item['port'])}</span>" if item.get("port") else ""
        status = esc(item.get("status") or "unknown")
        exists = "present" if item.get("exists") else "missing"
        cards.append(
            f"""
            <article class="mod">
              <header>
                <h3>{esc(item.get('name'))}</h3>
                {port}
              </header>
              <p>{esc(item.get('purpose'))}</p>
              <footer>
                <span class="tag">{esc(item.get('sector'))}</span>
                <span class="tag">{status}</span>
                <span class="tag {'ok' if item.get('exists') else 'warn'}">{exists}</span>
              </footer>
            </article>
            """
        )
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">{esc(title)}</p>
      <h1>{esc(heading)}</h1>
      <p class="lede tight">{esc(sub)}</p>
    </div>
  </header>
  <div class="mod-grid animate-in delay-1">{''.join(cards)}</div>
</main>
"""
    return layout(title=title, body=body, nav=nav, **kwargs)


def infrastructure_page(*, hardening: dict, foundation: list[dict], **kwargs) -> str:
    checks = "".join(
        f"<li class='{'ok' if c.get('ok') else 'bad'}'><strong>{esc(c.get('id'))}</strong> — {esc(c.get('detail'))}</li>"
        for c in hardening.get("checks") or []
    )
    controls = "".join(f"<li>{esc(c)}</li>" for c in hardening.get("controls") or [])
    foundation_rows = "".join(
        f"<li><strong>{esc(f.get('name'))}</strong> — {esc(f.get('purpose'))}</li>"
        for f in foundation
    )
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Infrastructure</p>
      <h1>Foundation & hardening</h1>
      <p class="lede tight">Security posture score <strong>{esc(hardening.get('score'))}</strong> / 100.</p>
    </div>
  </header>
  <div class="grid-2 animate-in delay-1">
    <section class="panel">
      <h2>Hardening checks</h2>
      <ul class="checks">{checks}</ul>
    </section>
    <section class="panel">
      <h2>Active controls</h2>
      <ul class="list">{controls}</ul>
    </section>
  </div>
  <section class="panel animate-in delay-2">
    <h2>Foundation modules</h2>
    <ul class="list">{foundation_rows}</ul>
  </section>
</main>
"""
    return layout(title="Infrastructure", body=body, nav="infrastructure", **kwargs)


def simple_console_page(*, title: str, heading: str, sub: str, content: str, nav: str, **kwargs) -> str:
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">{esc(title)}</p>
      <h1>{esc(heading)}</h1>
      <p class="lede tight">{esc(sub)}</p>
    </div>
  </header>
  <section class="panel animate-in delay-1">{content}</section>
</main>
"""
    return layout(title=title, body=body, nav=nav, **kwargs)


def marketplace_page(*, tiers: list[dict], **kwargs) -> str:
    cards = []
    for t in tiers:
        feats = "".join(f"<li>{esc(f)}</li>" for f in t.get("features") or [])
        hl = " highlight" if t.get("highlight") else ""
        cards.append(
            f"""
            <article class="tier{hl}">
              <header>
                <h3>{esc(t.get('name'))}</h3>
                <p class="price"><strong>${esc(t.get('priceMonthly'))}</strong><span>/mo</span></p>
              </header>
              <p class="tagline">{esc(t.get('tagline'))}</p>
              <p class="explain">{esc(t.get('explanation'))}</p>
              <ul class="feat">{feats}</ul>
              <p class="price-annual">${esc(t.get('priceAnnual'))} / year · {esc(t.get('seats'))} seat(s)</p>
              <a class="btn {'primary' if t.get('highlight') else 'ghost'} block" href="/signup?tier={esc(t.get('id'))}">Elect {esc(t.get('name'))}</a>
            </article>
            """
        )
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Marketplace</p>
      <h1>Membership tiers</h1>
      <p class="lede tight">Four plans with detailed scope. Payment method on file required. Autopay available.</p>
    </div>
  </header>
  <p class="zero-banner animate-in">ZERO REFUNDS — ABSOLUTELY ZERO. No prorations. No chargeback courtesy credits. Fees are final upon authorization.</p>
  <div class="tier-grid animate-in delay-1">{''.join(cards)}</div>
  <section class="panel animate-in delay-2">
    <h2>Before you elect</h2>
    <p>Read <a class="gold" href="/legal">Rules, Regulations, Policy, Disclaimers &amp; Disclosures</a>. Creating an account requires membership election, a payment method on file, and explicit acceptance of the absolute zero-refund policy.</p>
  </section>
</main>
"""
    return layout(title="Marketplace", body=body, nav="marketplace", path="/marketplace", index=True, breadcrumbs=[("Home", "/"), ("Marketplace", "/marketplace")], description=f"{APP_NAME} membership tiers — Starter, Professional, Firm, Enterprise. Payment on file and autopay. Zero refunds.", **kwargs)


def membership_election_page(
    *,
    tiers: list[dict],
    checklist: list[str],
    csrf: str,
    selected_tier: str = "professional",
    error: str | None = None,
    **kwargs,
) -> str:
    options = []
    for t in tiers:
        checked = " checked" if t.get("id") == selected_tier else ""
        options.append(
            f"""
            <label class="tier-option{' highlight' if t.get('highlight') else ''}">
              <input type="radio" name="tierId" value="{esc(t.get('id'))}" required{checked} />
              <span>
                <strong>{esc(t.get('name'))}</strong> — ${esc(t.get('priceMonthly'))}/mo
                <em>{esc(t.get('tagline'))}</em>
                <small>{esc(t.get('explanation'))}</small>
              </span>
            </label>
            """
        )
    checks = "".join(
        f'<label class="check"><input type="checkbox" name="accept_{i}" value="1" required /> {esc(c)}</label>'
        for i, c in enumerate(checklist)
    )
    err = f'<p class="form-error">{esc(error)}</p>' if error else ""
    body = f"""
<main class="console narrow">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Step 02 · Membership election</p>
      <h1>Choose your tier</h1>
      <p class="lede tight">Select a plan and billing cadence. Next you will place a payment method on file for autopay.</p>
    </div>
  </header>
  <p class="zero-banner">ZERO REFUNDS — ABSOLUTELY ZERO.</p>
  {err}
  <form method="post" action="/membership" class="panel gate-form animate-in delay-1">
    <input type="hidden" name="csrf" value="{esc(csrf)}" />
    <fieldset class="tier-options">
      <legend>Membership tier</legend>
      {''.join(options)}
    </fieldset>
    <label>Billing cadence
      <select name="cadence" required>
        <option value="monthly">Monthly</option>
        <option value="annual">Annual (10× monthly list)</option>
      </select>
    </label>
    <div class="accept-stack">{checks}</div>
    <label class="check danger">
      <input type="checkbox" name="zeroRefunds" value="1" required />
      I agree: <strong>ZERO REFUNDS — ABSOLUTELY ZERO</strong> — no exceptions, no prorations, no credits.
    </label>
    <button class="btn primary block" type="submit">Continue to payment</button>
  </form>
</main>
"""
    return layout(title="Membership election", body=body, nav="membership", csrf=csrf, **kwargs)


def payment_page(
    *,
    tier: dict,
    cadence: str,
    amount: int,
    csrf: str,
    error: str | None = None,
    **kwargs,
) -> str:
    err = f'<p class="form-error">{esc(error)}</p>' if error else ""
    body = f"""
<main class="console narrow">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Step 03 · Payment selection</p>
      <h1>Payment method on file</h1>
      <p class="lede tight">Authorize <strong>{esc(tier.get('name'))}</strong> ({esc(cadence)}) for <strong>${esc(amount)} USD</strong>. Card details are tokenized — PAN/CVC are never stored.</p>
    </div>
  </header>
  <p class="zero-banner">Payment is final. ZERO REFUNDS — ABSOLUTELY ZERO.</p>
  {err}
  <form method="post" action="/payment" class="panel gate-form animate-in delay-1" autocomplete="off">
    <input type="hidden" name="csrf" value="{esc(csrf)}" />
    <label>Name on card
      <input name="cardName" required placeholder="Operator name" />
    </label>
    <label>Card number
      <input name="cardNumber" inputmode="numeric" required placeholder="4242 4242 4242 4242" />
    </label>
    <div class="row-2">
      <label>Exp month
        <input name="expMonth" required placeholder="01" maxlength="2" />
      </label>
      <label>Exp year
        <input name="expYear" required placeholder="2030" maxlength="4" />
      </label>
    </div>
    <div class="row-2">
      <label>CVC
        <input name="cvc" required placeholder="123" maxlength="4" />
      </label>
      <label>ZIP
        <input name="zip" placeholder="Optional" />
      </label>
    </div>
    <label class="check">
      <input type="checkbox" name="autopay" value="1" checked />
      Enable autopay — charge this payment method on file at each renewal
    </label>
    <label class="check danger">
      <input type="checkbox" name="zeroRefunds" value="1" required />
      I authorize this charge and agree: <strong>ZERO REFUNDS — ABSOLUTELY ZERO</strong>
    </label>
    <label class="check">
      <input type="checkbox" name="disclosures" value="1" required />
      I accept the <a class="gold" href="/legal" target="_blank">Disclosures &amp; Policy</a>
    </label>
    <button class="btn primary block" type="submit">Place payment method &amp; activate membership</button>
  </form>
</main>
"""
    return layout(title="Payment", body=body, nav="payment", csrf=csrf, **kwargs)


def billing_page(
    *,
    membership: dict | None,
    payment_method: dict | None,
    charges: list[dict],
    **kwargs,
) -> str:
    mem = membership or {}
    pm = payment_method or {}
    charge_rows = "".join(
        f"<li><code>${esc(c.get('amount'))}</code> {esc(c.get('tierId'))} · {esc(c.get('status'))} · refundable={esc(c.get('refundable'))} · ****{esc(c.get('last4'))}</li>"
        for c in charges[::-1]
    ) or "<li class='muted'>No charges yet</li>"
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Billing</p>
      <h1>Membership &amp; payment on file</h1>
      <p class="lede tight">Autopay status, tokenized payment method, and non-refundable charge history.</p>
    </div>
  </header>
  <p class="zero-banner">ZERO REFUNDS — ABSOLUTELY ZERO. All captured charges are final.</p>
  <div class="grid-2 animate-in delay-1">
    <section class="panel">
      <h2>Membership</h2>
      <ul class="list">
        <li>Tier: <strong>{esc(mem.get('tierName') or '—')}</strong></li>
        <li>Cadence: {esc(mem.get('cadence') or '—')}</li>
        <li>Amount: ${esc(mem.get('amount') or '—')} {esc(mem.get('currency') or 'USD')}</li>
        <li>Autopay: {esc(mem.get('autopay'))}</li>
        <li>Status: {esc(mem.get('status') or 'inactive')}</li>
        <li>Zero-refund accepted: {esc(mem.get('zeroRefundAccepted'))}</li>
      </ul>
      <div class="action-row">
        <a class="btn ghost" href="/membership">Change election</a>
        <a class="btn ghost" href="/marketplace">Compare tiers</a>
      </div>
    </section>
    <section class="panel">
      <h2>Payment method on file</h2>
      <ul class="list">
        <li>Brand: {esc(pm.get('brand') or '—')}</li>
        <li>Last4: ****{esc(pm.get('last4') or '————')}</li>
        <li>Exp: {esc(pm.get('expMonth') or '—')}/{esc(pm.get('expYear') or '—')}</li>
        <li>Name: {esc(pm.get('name') or '—')}</li>
        <li>Token: {esc((pm.get('id') or '—')[:18])}…</li>
      </ul>
      <a class="btn ghost" href="/payment">Update payment method</a>
    </section>
  </div>
  <section class="panel animate-in delay-2">
    <h2>Charges (non-refundable)</h2>
    <ul class="feed">{charge_rows}</ul>
  </section>
</main>
"""
    return layout(title="Billing", body=body, nav="billing", **kwargs)


def users_page(*, members: list[dict], **kwargs) -> str:
    rows = "".join(
        f"<tr><td>{esc(m.get('name'))}</td><td>{esc(m.get('email'))}</td><td>{esc(m.get('tierName') or '—')}</td><td>{esc(m.get('cadence') or '—')}</td><td>{'autopay' if m.get('autopay') else 'manual'}</td><td>****{esc(m.get('last4') or '')}</td><td>{esc(m.get('status') or 'pending')}</td></tr>"
        for m in members
    ) or "<tr><td colspan='7' class='muted'>No members yet</td></tr>"
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Users</p>
      <h1>Membership roster</h1>
      <p class="lede tight">{esc(len(members))} operator account(s) with tier and payment-on-file status.</p>
    </div>
    <a class="btn primary" href="/signup">Register</a>
  </header>
  <section class="panel animate-in delay-1 table-wrap">
    <table class="data">
      <thead><tr><th>Name</th><th>Email</th><th>Tier</th><th>Cadence</th><th>Autopay</th><th>Card</th><th>Status</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </section>
</main>
"""
    return layout(title="Users", body=body, nav="users", **kwargs)


def legal_page(*, sections: list[dict], banner: str, **kwargs) -> str:
    blocks = []
    for s in sections:
        items = "".join(f"<li>{esc(line)}</li>" for line in s.get("body") or [])
        blocks.append(
            f"""
            <section class="panel" id="{esc(s.get('id'))}">
              <h2>{esc(s.get('title'))}</h2>
              <p class="lede tight">{esc(s.get('summary'))}</p>
              <ul class="legal-list">{items}</ul>
            </section>
            """
        )
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Rules · Regs · Policy · Disclaimers · Disclosures</p>
      <h1>Legal &amp; commercial terms</h1>
      <p class="lede tight">Material terms governing membership election, payment on file, and autopay.</p>
    </div>
  </header>
  <p class="zero-banner animate-in">{esc(banner)}</p>
  <nav class="legal-nav animate-in delay-1">
    <a href="#rules">Rules</a>
    <a href="#regulations">Regulations</a>
    <a href="#policy">Policy</a>
    <a href="#disclaimers">Disclaimers</a>
    <a href="#disclosures">Disclosures</a>
  </nav>
  <div class="animate-in delay-2">{''.join(blocks)}</div>
</main>
"""
    return layout(title="Legal", body=body, nav="legal", path="/legal", index=True, breadcrumbs=[("Home", "/"), ("Legal", "/legal")], description=f"{APP_NAME} rules, regulations, policy, disclaimers, and disclosures. Absolute zero refunds.", **kwargs)


def verify_email_page(
    *,
    email: str,
    csrf: str,
    dev_code: str | None = None,
    delivery_detail: str = "",
    error: str | None = None,
    flash: str | None = None,
    **kwargs,
) -> str:
    err = f'<p class="form-error">{esc(error)}</p>' if error else ""
    flash_h = f'<p class="ok-msg">{esc(flash)}</p>' if flash else ""
    dev = ""
    if dev_code:
        dev = f"""
        <div class="dev-code panel-inline">
          <strong>Development delivery</strong>
          <p>SMTP is not configured. Your 6-digit verification code is:</p>
          <p class="code-xl">{esc(dev_code)}</p>
          <p class="muted">{esc(delivery_detail)}</p>
        </div>
        """
    body = f"""
<main class="console narrow">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Step 01b · Email verification</p>
      <h1>Verify your email</h1>
      <p class="lede tight">We sent a <strong>6-digit code</strong> to <strong>{esc(email)}</strong>. Enter it to continue.</p>
    </div>
  </header>
  {err}{flash_h}{dev}
  <form method="post" action="/verify-email" class="panel gate-form animate-in delay-1">
    <input type="hidden" name="csrf" value="{esc(csrf)}" />
    <label>6-digit code
      <input name="code" inputmode="numeric" pattern="[0-9]{{6}}" maxlength="6" minlength="6" required placeholder="123456" autocomplete="one-time-code" />
    </label>
    <button class="btn primary block" type="submit">Verify email</button>
  </form>
  <form method="post" action="/verify-email/resend" class="inline-resend animate-in delay-2">
    <input type="hidden" name="csrf" value="{esc(csrf)}" />
    <button class="btn ghost block" type="submit">Resend code</button>
  </form>
</main>
"""
    return layout(title="Verify email", body=body, nav="verify", csrf=csrf, **kwargs)


def set_password_page(
    *,
    email: str,
    csrf: str,
    github_login: str | None = None,
    error: str | None = None,
    **kwargs,
) -> str:
    err = f'<p class="form-error">{esc(error)}</p>' if error else ""
    gh_note = ""
    if github_login:
        gh_note = (
            f'<p class="ok-msg">GitHub account <strong>@{esc(github_login)}</strong> is linked. '
            f"Create a local {esc(APP_NAME)} password to continue — required even with GitHub sign-in.</p>"
        )
    else:
        gh_note = (
            f'<p class="ok-msg">Create a local {esc(APP_NAME)} password. Required for console access and '
            "password sign-in alongside any linked providers.</p>"
        )
    body = f"""
<main class="console narrow">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Step 01b · Local password</p>
      <h1>Create your password</h1>
      <p class="lede tight">Account <strong>{esc(email)}</strong> must have a {esc(APP_NAME)} password before MFA and membership.</p>
    </div>
  </header>
  {err}{gh_note}
  <form method="post" action="/set-password" class="panel gate-form animate-in delay-1">
    <input type="hidden" name="csrf" value="{esc(csrf)}" />
    <label>Password
      <input type="password" name="password" required autocomplete="new-password" minlength="10" placeholder="At least 10 characters · letters + numbers" />
    </label>
    <label>Confirm password
      <input type="password" name="confirm" required autocomplete="new-password" minlength="10" placeholder="Re-enter password" />
    </label>
    <button class="btn primary block" type="submit">Save password &amp; continue</button>
  </form>
</main>
"""
    return layout(title="Create password", body=body, nav="set-password", csrf=csrf, **kwargs)


def setup_mfa_page(
    *,
    email: str,
    secret: str,
    otpauth: str,
    csrf: str,
    error: str | None = None,
    **kwargs,
) -> str:
    err = f'<p class="form-error">{esc(error)}</p>' if error else ""
    body = f"""
<main class="console narrow">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Step 01c · MFA / 2FA enrollment</p>
      <h1>Enable authenticator MFA</h1>
      <p class="lede tight">Add {esc(APP_NAME)} to your authenticator app (TOTP), then enter the <strong>6-digit</strong> code. Email OTP remains available as a backup factor at sign-in.</p>
    </div>
  </header>
  {err}
  <section class="panel animate-in delay-1">
    <h2>Authenticator setup</h2>
    <p class="muted">Account: {esc(email)}</p>
    <p>Secret key:</p>
    <p class="code-xl wrap">{esc(secret)}</p>
    <p class="muted break">otpauth URI:</p>
    <p class="mono-small break">{esc(otpauth)}</p>
  </section>
  <form method="post" action="/setup-mfa" class="panel gate-form animate-in delay-2">
    <input type="hidden" name="csrf" value="{esc(csrf)}" />
    <label>6-digit authenticator code
      <input name="code" inputmode="numeric" pattern="[0-9]{{6}}" maxlength="6" minlength="6" required placeholder="123456" autocomplete="one-time-code" />
    </label>
    <button class="btn primary block" type="submit">Enable MFA / 2FA</button>
  </form>
</main>
"""
    return layout(title="Setup MFA", body=body, nav="mfa-setup", csrf=csrf, **kwargs)


def mfa_challenge_page(
    *,
    email: str,
    csrf: str = "",
    dev_code: str | None = None,
    error: str | None = None,
    flash: str | None = None,
    **kwargs,
) -> str:
    err = f'<p class="form-error">{esc(error)}</p>' if error else ""
    flash_h = f'<p class="ok-msg">{esc(flash)}</p>' if flash else ""
    dev = ""
    if dev_code:
        dev = f"""
        <div class="dev-code panel-inline">
          <strong>Development delivery</strong>
          <p>Email MFA code:</p>
          <p class="code-xl">{esc(dev_code)}</p>
        </div>
        """
    body = f"""
<main class="console narrow">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">MFA / 2FA challenge</p>
      <h1>Confirm it is you</h1>
      <p class="lede tight">Enter the <strong>6-digit</strong> code from your authenticator app, or request an email code for <strong>{esc(email)}</strong>.</p>
    </div>
  </header>
  {err}{flash_h}{dev}
  <form method="post" action="/mfa" class="panel gate-form animate-in delay-1">
    <input type="hidden" name="csrf" value="{esc(csrf)}" />
    <label>Factor
      <select name="factor">
        <option value="totp">Authenticator app (TOTP)</option>
        <option value="email">Email 6-digit code</option>
      </select>
    </label>
    <label>6-digit code
      <input name="code" inputmode="numeric" pattern="[0-9]{{6}}" maxlength="6" minlength="6" required placeholder="123456" autocomplete="one-time-code" />
    </label>
    <button class="btn primary block" type="submit">Verify &amp; sign in</button>
  </form>
  <form method="post" action="/mfa/email" class="inline-resend animate-in delay-2">
    <input type="hidden" name="csrf" value="{esc(csrf)}" />
    <button class="btn ghost block" type="submit">Send email MFA code</button>
  </form>
</main>
"""
    return layout(title="MFA", body=body, nav="mfa", **kwargs)


def rbac_page(*, matrix: dict, decisions: list, members: list, csrf: str, **kwargs) -> str:
    role_cards = []
    for r in matrix.get("roles") or []:
        perms = "".join(f"<li><code>{esc(p)}</code></li>" for p in (r.get("permissions") or [])[:8])
        more = len(r.get("permissions") or []) - 8
        extra = f"<li class='muted'>+{more} more</li>" if more > 0 else ""
        role_cards.append(
            f"""
            <article class="mod">
              <header><h3>{esc(r.get('id'))}</h3><span class="tag">{esc(r.get('permissionCount'))} perms</span></header>
              <p>{esc(r.get('description'))}</p>
              <ul class="list">{perms}{extra}</ul>
            </article>
            """
        )
    discipline = "".join(f"<li>{esc(d)}</li>" for d in matrix.get("discipline") or [])
    dec = "".join(
        f"<li><code>{'allow' if d.get('allowed') else 'deny'}</code> {esc(d.get('email') or d.get('actor'))} · {esc(d.get('permission'))} · {esc(d.get('detail') or '')}</li>"
        for d in decisions[::-1][:20]
    ) or "<li class='muted'>No RBAC decisions yet</li>"
    options = "".join(f"<option value='{esc(r['id'])}'>{esc(r['id'])}</option>" for r in matrix.get("roles") or [])
    user_opts = "".join(f"<option value='{esc(m.get('email'))}'>{esc(m.get('email'))} ({esc(m.get('role'))})</option>" for m in members)
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">RBAC</p>
      <h1>Roles &amp; permissions</h1>
      <p class="lede tight">Strict, disciplined, deny-by-default access control. Transparent decision log.</p>
    </div>
  </header>
  <section class="panel animate-in delay-1">
    <h2>Discipline</h2>
    <ul class="legal-list">{discipline}</ul>
  </section>
  <div class="mod-grid animate-in delay-2">{''.join(role_cards)}</div>
  <section class="panel animate-in delay-3">
    <h2>Assign role</h2>
    <form method="post" action="/rbac/assign" class="gate-form">
      <input type="hidden" name="csrf" value="{esc(csrf)}" />
      <label>User<select name="email" required>{user_opts}</select></label>
      <label>Role<select name="role" required>{options}</select></label>
      <button class="btn primary" type="submit">Assign</button>
    </form>
  </section>
  <section class="panel">
    <h2>Recent RBAC decisions</h2>
    <ul class="feed">{dec}</ul>
  </section>
</main>
"""
    return layout(title="RBAC", body=body, nav="rbac", csrf=csrf, **kwargs)


def execute_page(
    *,
    scripts: list,
    executions: list,
    csrf: str,
    result: dict | None = None,
    error: str | None = None,
    flash: str | None = None,
    **kwargs,
) -> str:
    opts = "".join(
        f"<option value='{esc(s.get('id'))}'>{esc(s.get('scope'))}: {esc(s.get('name'))}</option>"
        for s in scripts
    ) or "<option value=''>No scripts available</option>"
    err = f'<p class="form-error">{esc(error)}</p>' if error else ""
    flash_h = f'<p class="ok-msg">{esc(flash)}</p>' if flash else ""
    result_h = ""
    if result:
        result_h = f"""
        <section class="panel">
          <h2>Last execution (transparent)</h2>
          <ul class="list">
            <li>ok: <strong>{esc(result.get('ok'))}</strong></li>
            <li>script: {esc(result.get('scriptId'))}</li>
            <li>path: {esc(result.get('path'))}</li>
            <li>duration: {esc(result.get('durationMs'))} ms</li>
            <li>policy: {esc(result.get('policy') or 'clean')}</li>
          </ul>
          <h3>stdout</h3>
          <pre class="exec-out">{esc(result.get('stdout') or '(empty)')}</pre>
          <h3>stderr</h3>
          <pre class="exec-out">{esc(result.get('stderr') or '(empty)')}</pre>
        </section>
        """
    hist = "".join(
        f"<li><code>{'ok' if e.get('ok') else 'fail'}</code> {esc(e.get('scriptId'))} · {esc(e.get('durationMs'))}ms · {esc(e.get('email'))}</li>"
        for e in executions[::-1][:15]
    ) or "<li class='muted'>No executions yet</li>"
    body = f"""
<main class="console">
  <header class="console-head animate-in">
    <div>
      <p class="eyebrow">Transparent code execution</p>
      <h1>Run scripts for your purposes</h1>
      <p class="lede tight">RBAC-gated execution with AST policy checks. Every run is audited with full stdout/stderr visibility.</p>
    </div>
  </header>
  {err}{flash_h}
  <div class="grid-2 animate-in delay-1">
    <form method="post" action="/execute" class="panel gate-form">
      <input type="hidden" name="csrf" value="{esc(csrf)}" />
      <h2>Execute</h2>
      <label>Script<select name="scriptId" required>{opts}</select></label>
      <button class="btn primary block" type="submit">Execute transparently</button>
    </form>
    <form method="post" action="/execute/save" class="panel gate-form">
      <input type="hidden" name="csrf" value="{esc(csrf)}" />
      <h2>Save personal script</h2>
      <label>Name<input name="name" required placeholder="my_job.py" /></label>
      <label>Source<textarea name="source" rows="10" required placeholder="print('hello from my script')"></textarea></label>
      <button class="btn ghost block" type="submit">Save for my use</button>
    </form>
  </div>
  {result_h}
  <section class="panel animate-in delay-2">
    <h2>Execution audit</h2>
    <ul class="feed">{hist}</ul>
  </section>
</main>
"""
    return layout(title="Execute", body=body, nav="execute", csrf=csrf, **kwargs)
