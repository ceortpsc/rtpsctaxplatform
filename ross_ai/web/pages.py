"""Shared HTML chrome and page renderers for Ross operator console."""

from __future__ import annotations

import html
from typing import Any


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
) -> str:
    auth_links = ""
    if user:
        auth_links = f"""
        <a class="nav-link" href="/dashboard">Console</a>
        <a class="nav-link" href="/modules">Modules</a>
        <a class="nav-link" href="/engines">Engines</a>
        <a class="nav-link" href="/systems">Systems</a>
        <a class="nav-link" href="/infrastructure">Infrastructure</a>
        <span class="nav-user">{esc(user.get('name'))}</span>
        <form class="inline" method="post" action="/logout">
          <input type="hidden" name="csrf" value="{esc(csrf)}" />
          <button type="submit" class="nav-link btn-link">Sign out</button>
        </form>
        """
    else:
        auth_links = """
        <a class="nav-link" href="/signin">Sign in</a>
        <a class="nav-cta" href="/signup">Create access</a>
        """

    flash_html = f'<div class="flash" role="status">{esc(flash)}</div>' if flash else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{esc(title)} · Ross AI Runtime Platform</title>
  <link rel="stylesheet" href="/static/app.css" />
</head>
<body data-nav="{esc(nav)}" data-authed="{1 if user else 0}">
  <div class="atmosphere" aria-hidden="true"></div>
  <header class="topbar">
    <a class="mark" href="/">Ross <em>AI</em></a>
    <nav class="nav">{auth_links}</nav>
  </header>
  {flash_html}
  {body}
  <script src="/static/app.js" defer></script>
  {scripts}
</body>
</html>
"""


def landing_page(**kwargs) -> str:
    body = """
<main class="hero">
  <p class="eyebrow animate-in">Ross Tax Software</p>
  <h1 class="brand-hero animate-in delay-1">Ross <span>AI</span><br/>Runtime Platform</h1>
  <p class="lede animate-in delay-2">Command packages, live runtime, deploy plans, and the operator control plane — on one hardened host.</p>
  <div class="cta-row animate-in delay-3">
    <a class="btn primary" href="/signup">Request access</a>
    <a class="btn ghost" href="/signin">Sign in</a>
    <a class="btn ghost" href="/health">Health</a>
  </div>
</main>
<section class="strip" aria-label="Platform pillars">
  <div><strong>Packages</strong><span>.rpkg build + checksum seal</span></div>
  <div><strong>Runtime</strong><span>Script runner + live WS feed</span></div>
  <div><strong>Deploy</strong><span>Eight-target plan fabric</span></div>
  <div><strong>Hardening</strong><span>Sessions, CSRF, CSP, limits</span></div>
</section>
"""
    return layout(title="Home", body=body, nav="landing", **kwargs)


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
    {alt}
  </div>
</main>
"""
    return layout(title=heading, body=body, nav="gate", csrf=csrf, **kwargs)


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
      <a class="btn ghost" href="/modules">All modules</a>
      <a class="btn ghost" href="/engines">Engines</a>
      <a class="btn ghost" href="/systems">Systems</a>
      <a class="btn ghost" href="/infrastructure">Infrastructure</a>
      <a class="btn ghost" href="/packages">Packages</a>
      <a class="btn ghost" href="/deploy">Deploy</a>
      <a class="btn ghost" href="/runtime">Runtime</a>
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
