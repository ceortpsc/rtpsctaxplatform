# @rtp/secure-tunnel

Actual secure-tunnel adapter for RTPSC transmitters and approved IRS communications.

## Status model

| Status | Meaning |
|--------|---------|
| `stub` | No tunnel endpoint / client configured |
| `blocked` | Partial config or endpoint not allowlisted |
| `configured` | Allowlisted HTTPS endpoint + tunnel client present; live transmit still held |
| `ready` | Production environment protection permits transmission handoff |

Live IRS sockets are never opened from this package alone. When `ready`, transmit()
records an authorized handoff intent toward `irs-gateway`.

## Configure

```bash
cp env/.env.local.example .env
# set:
# APPROVED_TUNNEL_ENDPOINT=https://api.irs.gov/oauth2/v1/token
# TUNNEL_CLIENT_ID=...
# TUNNEL_CLIENT_SECRET=...   # never commit
./rtpsc config doctor
```

## Topology

`src/topology.mjs` enumerates every local gateway/service/worker/pipeline and the
approved external HTTPS allowlist (IRS + Apple). Scraping hosts are never allowlisted.
