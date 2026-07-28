// Minimal, dependency-free PDF text extractor (Node built-ins only).
//
// Handles the common case for machine-generated PDFs (e.g. IRS e-Services
// "e-file Application Summary"): content streams that are either uncompressed or
// FlateDecode-compressed, with text shown via literal `(...)` / hex `<...>`
// strings (Tj / TJ / ' / " operators). Custom CID font encodings are not decoded
// (best-effort scaffold) — enough to locate EFIN, firm, and status labels.

import zlib from 'node:zlib';

function tryInflate(buffer) {
  try {
    return zlib.inflateSync(buffer);
  } catch {
    try {
      return zlib.inflateRawSync(buffer);
    } catch {
      return null;
    }
  }
}

/** Extract literal + hex strings from a content stream, in reading order. */
function extractTextTokens(content) {
  let out = '';
  let i = 0;
  const n = content.length;
  while (i < n) {
    const ch = content[i];
    if (ch === '(') {
      let depth = 1;
      i += 1;
      let str = '';
      while (i < n && depth > 0) {
        const c = content[i];
        if (c === '\\') {
          const nx = content[i + 1];
          if (nx === 'n') { str += '\n'; i += 2; }
          else if (nx === 'r') { str += '\r'; i += 2; }
          else if (nx === 't') { str += '\t'; i += 2; }
          else if (nx === 'b') { str += '\b'; i += 2; }
          else if (nx === 'f') { str += '\f'; i += 2; }
          else if (nx === '(') { str += '('; i += 2; }
          else if (nx === ')') { str += ')'; i += 2; }
          else if (nx === '\\') { str += '\\'; i += 2; }
          else if (nx >= '0' && nx <= '7') {
            let oct = nx;
            i += 2;
            let k = 0;
            while (k < 2 && content[i] >= '0' && content[i] <= '7') { oct += content[i]; i += 1; k += 1; }
            str += String.fromCharCode(parseInt(oct, 8) & 0xff);
          } else if (nx === '\n') { i += 2; }
          else if (nx === '\r') { i += 2; if (content[i] === '\n') i += 1; }
          else { str += nx; i += 2; }
        } else if (c === '(') { depth += 1; str += c; i += 1; }
        else if (c === ')') { depth -= 1; if (depth > 0) str += c; i += 1; }
        else { str += c; i += 1; }
      }
      out += `${str} `;
    } else if (ch === '<' && content[i + 1] !== '<') {
      let j = i + 1;
      let hex = '';
      while (j < n && content[j] !== '>') {
        if (/[0-9a-fA-F]/.test(content[j])) hex += content[j];
        j += 1;
      }
      i = j + 1;
      if (hex.length % 2) hex += '0';
      let str = '';
      for (let k = 0; k < hex.length; k += 2) str += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
      out += `${str} `;
    } else {
      i += 1;
    }
  }
  return out;
}

/**
 * Extract readable text from a PDF buffer.
 * @param {Buffer|Uint8Array} input
 * @returns {string}
 */
export function extractPdfText(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const s = bytes.toString('latin1');
  const chunks = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let match;
  while ((match = re.exec(s)) !== null) {
    const dict = s.slice(Math.max(0, match.index - 800), match.index);
    let data = match[1].replace(/\r?\n$/, '');
    let content;
    if (/\/FlateDecode/.test(dict)) {
      const inflated = tryInflate(Buffer.from(data, 'latin1'));
      if (!inflated) continue;
      content = inflated.toString('latin1');
    } else {
      content = data;
    }
    chunks.push(extractTextTokens(content));
  }
  return chunks
    .join('\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
