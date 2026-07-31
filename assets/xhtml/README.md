# XHTML Assets — Signal Era

Approved XHTML payload templates and validation fixtures for the RTPSC public
portal (`services/web-portal`). Sovereign Ledger cream · gold · serif payloads
are **not approved**.

## Rules

- Output `application/xhtml+xml` (XML prolog + XHTML namespace).
- Void tags must self-close (`<meta … />`, `<link … />`, `<input … />`).
- Escape dynamic text; wrap JSON-LD in `/*<![CDATA[*/ … /*]]>*/`.
- First viewport: brand-first Signal Era hero (mist · signal · graphite · Syne).
- No cards in the hero; interactive containers only where the user acts.

## Fixtures

| File | Purpose |
|------|---------|
| `signal-era-shell.xhtml` | Minimal approved document shell |
| `signal-era-hero.xhtml` | Full-bleed brand hero fragment |

Validate locally by starting the portal and fetching routes with
`Accept: application/xhtml+xml`, or run `pnpm test` / `./rtpsc test`.
