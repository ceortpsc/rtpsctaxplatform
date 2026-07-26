// Minimal PDF 1.4 writer (Helvetica) — zero external dependencies.
// Produces a valid single-page PDF Buffer from an array of text lines.

function escapePdf(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * @param {string[]} lines
 * @param {{ title?: string, pageWidth?: number, pageHeight?: number, fontSize?: number, margin?: number, lineHeight?: number }} [opts]
 * @returns {Buffer}
 */
export function buildTextPdf(lines, opts = {}) {
  const pageWidth = opts.pageWidth ?? 612; // US Letter
  const pageHeight = opts.pageHeight ?? 792;
  const fontSize = opts.fontSize ?? 10;
  const margin = opts.margin ?? 48;
  const lineHeight = opts.lineHeight ?? fontSize + 4;
  const title = opts.title ?? 'Document';

  let y = pageHeight - margin;
  const content = ['BT', `/F1 ${fontSize} Tf`, `${margin} ${y} Td`];
  let first = true;
  for (const raw of lines) {
    const line = String(raw ?? '');
    if (!first) content.push(`0 -${lineHeight} Td`);
    first = false;
    content.push(`(${escapePdf(line)}) Tj`);
    y -= lineHeight;
    if (y < margin) break;
  }
  content.push('ET');
  const stream = content.join('\n');

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`
  );
  objects.push(`4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let pdf = `%PDF-1.4\n%âãÏÓ\n`;
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${escapePdf(title)}) /Producer (RTPSC Invoice Core) >> >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

/** Narrow thermal-style receipt PDF (80mm-ish width in points). */
export function buildReceiptPdf(lines, opts = {}) {
  return buildTextPdf(lines, {
    title: opts.title ?? 'Receipt',
    pageWidth: 226, // ~80mm
    pageHeight: Math.max(400, 40 + lines.length * 12),
    fontSize: 8,
    margin: 12,
    lineHeight: 10
  });
}
