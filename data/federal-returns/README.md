# Federal returns ledger

Drop approved **Full Report Export** CSV files here for local ingest.

- Live exports (`*.live.csv`, `*.csv`) are gitignored — they may contain taxpayer PII.
- Use `POST /rtpsc/ledger/import` on refund-status (`:3001`) or the api-gateway proxy (`:3000`).
- Policy: approved ledger only — no scraping / no live IRS / no live Treasury TOPS calls.
