/** Terminal styling for the modernized AOL Instant aesthetic. */
const enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.FORCE_COLOR !== '0';

const wrap = (open, close) => (text) => (enabled ? `\u001b[${open}m${text}\u001b[${close}m` : String(text));

export const ansi = {
  enabled,
  reset: enabled ? '\u001b[0m' : '',
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  underline: wrap(4, 24),
  // Next-level AOL signal palette
  cyan: wrap(38 + ';2;0;229;255', 39),       // electric cyan
  amber: wrap(38 + ';2;255;184;0', 39),       // signal amber (evolved AOL yellow)
  navy: wrap(38 + ';2;20;40;90', 39),
  sky: wrap(38 + ';2;120;180;255', 39),       // classic AOL blue evolved
  mint: wrap(38 + ';2;80;255;180', 39),
  rose: wrap(38 + ';2;255;90;140', 39),
  white: wrap(38 + ';2;240;248;255', 39),
  silver: wrap(38 + ';2;170;185;205', 39),
  bgNavy: wrap(48 + ';2;8;14;28', 49),
  bgPanel: wrap(48 + ';2;12;22;42', 49)
};
