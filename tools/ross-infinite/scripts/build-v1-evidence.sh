#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT=release-evidence/v1
mkdir -p "$OUT"
node -e "
const fs=require('fs'); const crypto=require('crypto'); const path=require('path');
const files=['package.json','src/cli.mjs','src/lib/resolver.mjs','src/lib/transfer.mjs','config/seo/ross.co.ownership.json'];
const lines=[];
for (const f of files) {
  const body=fs.readFileSync(f);
  const digest=crypto.createHash('sha256').update(body).digest('hex');
  lines.push(digest+'  '+f);
}
fs.writeFileSync('$OUT/SHA256SUMS', lines.join('\\n')+'\\n');
fs.writeFileSync('$OUT/build.json', JSON.stringify({
  product:'ROSS.CO Infinite',
  version: JSON.parse(fs.readFileSync('package.json','utf8')).version,
  builtAt: new Date().toISOString(),
  status:'production-candidate',
  deploymentStatus:'not-deployed'
}, null, 2)+'\\n');
console.log('wrote $OUT/SHA256SUMS and build.json');
"
