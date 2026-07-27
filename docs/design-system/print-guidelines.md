# Print Guidelines

- Use `data-theme="print"` or `mono-document` for documents.
- Hide chrome: sidebar, command bar, atmosphere, sticky nav (see `@media print` in
  theme.css and Ross AI app.css).
- Invoice / receipt PDFs: hand-rolled PDF 1.4 writer in `invoice-core` (no npm PDF libs).
- Thermal mode for receipt paper (mono, zero radius).
- Watermarks: `brand/watermarks/ledger-watermark.svg` at low opacity.
