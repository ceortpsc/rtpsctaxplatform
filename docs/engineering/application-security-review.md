# Application Security Review (UI / Control Plane)

**Scope:** Security-relevant behaviors of RTPSC web surfaces and Ross AI control plane as
implemented in this scaffold. Not a penetration test.

## Strengths observed

### Ross AI (`ross_ai/`)

- Session cookies: HttpOnly + SameSite; Secure flag when `ROSS_ENV` is prod/docker
- CSRF tokens on state-changing forms
- PBKDF2-SHA256 password hashing (210k iterations) per hardening checks
- Sliding-window rate limits (general + auth)
- Security headers via `apply_security_headers` (CSP, XFO, nosniff, COOP/CORP)
- MFA flows (email OTP / TOTP setup)
- Card PAN/CVC tokenized — not stored (billing stub)
- Transparent execution audit trail for script runs
- RBAC permission catalog with explicit role expansion
- GitHub OAuth state handling when configured

### Operator services

- Enrollment payment gate fail-closed (funding blocked unless prod + secrets + flags)
- SBTPG login audit JSONL with redacted usernames — secrets must never be logged
- API/TDS client secrets issued to gitignored files; Basic or header auth
- AI workforce rejects full SSN/TIN in hire payloads
- IRS gateway refuses token issuance until credentials configured

## Risks / gaps (honest)

| Risk | Severity | Notes |
|------|----------|-------|
| Scaffold ≠ production tax platform | Info | No claim of full IRS e-file or live bank product funding |
| Local JSON stores | Medium | Ross AI control-plane JSON is file-based — protect host FS |
| Dev OTP codes | Medium | Dev delivery may surface codes in UI — disable in prod |
| Service CSRF | Medium | Not all Node service POSTs use CSRF (local operator tools) |
| Client secret console print | Low | One-time boot print — ensure logs not shipped |
| Static asset cache | Low | Ross AI `Cache-Control: no-store` on HTML; static may differ |
| Cross-origin between ports | Medium | Multi-port local architecture — cookies don’t span ports; treat as separate origins |
| Prototype payment capture | High if misused | Membership charges are product policy stubs — wire real PSP carefully |

## UI unification security notes

- Brand SVG copies under `ross_ai/web/static/brand/` are static — no user upload path
- Skip links and focus styles improve keyboard security UX (not a vuln control)
- Do not load third-party fonts/CDNs (dependency-free posture preserved)

## Recommendations before production

1. External authN (OIDC) + secret manager for IRS/SBTPG credentials
2. Replace file JSON stores with durable DB + backups
3. Enforce CSP nonces if inline scripts expand
4. Formal threat model for multi-service deploy (`./rtpsc deploy`)
5. Penetration test on `:8787` auth/membership and `:3001` client auth

## Conclusion

Control-plane hardening primitives are thoughtful for a scaffold. Production cutover still
requires legal, security, data-governance, and operations sign-offs (see compliance docs).
Overall posture: **ready_scaffold**, not production-certified.
