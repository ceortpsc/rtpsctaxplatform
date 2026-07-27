# Forms

## Patterns

- **Auth / gate:** centered gate panel (Ross AI `/signin`, `/signup`, MFA, verify-email).
- **Form page:** `--form-max` width inside AppShell.
- **Wizard steps:** membership → payment on Ross AI; invoice draft → submit → approve → pay.

## Requirements

- Labels always visible (not placeholder-only).
- CSRF hidden field on Ross AI POSTs.
- Errors: `.form-error` / tone-danger; announce with `role="alert"` when dynamic.
- Focus: gold focus ring (`--ring-focus`).
- Autocomplete attributes on email/password/name.
- Secure-access language on auth pages (“Secure RTPSC operator access”).
