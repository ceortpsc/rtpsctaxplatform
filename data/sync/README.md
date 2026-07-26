# Data & table synchronization

Drop approved CSV or JSON table files here. Filenames map to tables:

| File | Table |
| --- | --- |
| `clients.csv` | clients |
| `refund_cases.csv` | refund_cases |
| `invoices.csv` | invoices |
| `tax_rates.csv` | tax_rates |
| `interactions.csv` | interactions |
| `federal_ledger.csv` | federal_ledger |

```bash
./rtpsc sync status
./rtpsc sync run
./rtpsc sync import clients data/sync/fixtures/clients.sample.csv
```

- `store.json` is written on sync and is **gitignored** (may contain operator data).
- Do not commit live taxpayer CSVs. Use synthetic fixtures under `fixtures/`.
- Policy: approved files only — no scraping.
