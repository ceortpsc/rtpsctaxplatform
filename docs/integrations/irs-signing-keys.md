# IRS signing key provisioning

Provision RS256 private keys used by `irs-gateway` for OAuth2 JWT client assertion.

```bash
./rtpsc provision irs-keys --json
./rtpsc provision irs-keys --production --enable-transmission --json
```

## Outputs (gitignored)

| Path | Purpose |
|---|---|
| `certs/irs_tds_private.key` | Primary IRS signing private key |
| `certs/irs_tds_public.pem` | Matching public key (register with IRS) |
| `certs/irs_tds_private_secondary.key` | Failover signing key |
| `certs/irs_tds_public_secondary.pem` | Failover public key |
| `build/irs-key-provision-report.json` | Redacted provision report |

`.env` is updated with `IRS_PRIVATE_KEY_PATH_*`, `IRS_KEY_ID_*`, and (when missing) operational `IRS_CLIENT_ID_*` values.

## Production launch

```bash
./rtpsc provision irs-keys --production --enable-transmission
./rtpsc config doctor --json
./rtpsc start irs          # :8820
./rtpsc start practitioner # :8880
./rtpsc start gateway      # :3000
```

Transmission becomes allowed only when `APP_ENV` is `production`/`prod`, API/TDS/tunnel secrets are set, an approved tunnel endpoint is configured, and `EFILE_TRANSMISSION_ENABLED=true`.

Replace locally provisioned `IRS_CLIENT_ID_*` with IRS-registered client ids and upload the public PEMs to the IRS developer portal before expecting live token success.
