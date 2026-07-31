# `@rtp/security-core`

Node-native security primitives for the RTPSC Tax Platform (no external deps).

## Capabilities

- HMAC-signed bearer access tokens (`SESSION_SECRET` / `JWT_SECRET`)
- AES-256-GCM field encryption (`ENCRYPTION_KEY`)
- Baseline HTTP security headers
- Sliding-window rate limiter
- Append-only security audit JSONL (`logs/security-audit.jsonl`)
- Aggregated security posture evaluation

## Fail-closed defaults

Token minting and field encryption return structured errors when secrets are unset
or still placeholder values (`replace-*`).

## CLI

```bash
./rtpsc security status
./rtpsc security secrets
./rtpsc security doctor
```
