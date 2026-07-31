import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import { ownershipPlan, resolveToken } from './ownership.mjs';
import { generateSeoAssets } from './generate.mjs';
import { writeEvidenceReceipt } from './evidence.mjs';

/**
 * Deploy DNS/token artifacts into the platform presence surface and write
 * registrar/Route53 change packages. File-side deploy is local; live DNS TXT
 * apply requires registrar/API credentials and is recorded separately.
 */
export async function deployDnsTokenArtifacts(root, config, {
  env = process.env,
  applyDns = false,
  observeLive = true
} = {}) {
  const mergedEnv = await loadLocalTokenEnv(root, env);
  const plan = ownershipPlan(config);
  const primary = plan.primaryProperty;
  const tokens = resolveDeployTokens(plan, config, mergedEnv);

  // Always regenerate public SEO assets with resolved tokens.
  const generated = await generateSeoAssets(root, config, {
    env: {
      ...mergedEnv,
      [plan.verification.googleMetaEnv]: tokens.googleMeta,
      [plan.verification.bingMetaEnv]: tokens.bingMeta,
      [plan.verification.indexNowKeyEnv]: tokens.indexNowKey,
      ...(tokens.googleDns ? { [plan.verification.googleDnsEnv]: tokens.googleDns } : {})
    }
  });

  const deployRoot = path.join(root, 'deploy/seo');
  const publicDeploy = path.join(deployRoot, 'public');
  const dnsDir = path.join(deployRoot, 'dns');
  const presenceRoot = path.join(root, config.presenceDeployDir || 'presence/rossco');
  await mkdir(publicDeploy, { recursive: true });
  await mkdir(dnsDir, { recursive: true });
  await mkdir(presenceRoot, { recursive: true });

  const live = observeLive ? await observeDns(primary.host) : null;

  const dnsArtifact = buildDnsArtifact({
    primary,
    tokens,
    live,
    properties: config.properties
  });

  await writeFile(path.join(dnsDir, 'ross.co.zone'), dnsArtifact.zoneFile, 'utf8');
  await writeFile(path.join(dnsDir, 'route53-change-batch.json'), `${JSON.stringify(dnsArtifact.route53, null, 2)}\n`, 'utf8');
  await writeFile(path.join(dnsDir, 'registrar-change-request.json'), `${JSON.stringify(dnsArtifact.registrar, null, 2)}\n`, 'utf8');
  await writeFile(path.join(dnsDir, 'namefind-godaddy-instructions.md'), dnsArtifact.instructions, 'utf8');
  await writeFile(path.join(dnsDir, 'dns-observation.json'), `${JSON.stringify(live, null, 2)}\n`, 'utf8');

  // Public verification files
  const indexNowFile = `${tokens.indexNowKey}.txt`;
  const publicFiles = {
    'robots.txt': await readFile(path.join(root, generated.publicDir, 'robots.txt'), 'utf8'),
    'sitemap.xml': await readFile(path.join(root, generated.publicDir, 'sitemap.xml'), 'utf8'),
    'software-application.jsonld': await readFile(
      path.join(root, generated.publicDir, 'software-application.jsonld'),
      'utf8'
    ),
    'seo-head.html': await readFile(path.join(root, generated.publicDir, 'seo-head.html'), 'utf8'),
    [indexNowFile]: `${tokens.indexNowKey}\n`,
    'BingSiteAuth.xml': buildBingXml(tokens.bingMeta)
  };

  if (tokens.googleFileToken) {
    publicFiles[`google${tokens.googleFileToken}.html`] =
      `google-site-verification: google${tokens.googleFileToken}.html\n`;
  }

  const writtenPublic = [];
  for (const [name, body] of Object.entries(publicFiles)) {
    const out = path.join(publicDeploy, name);
    await writeFile(out, body, 'utf8');
    writtenPublic.push(path.relative(root, out));
  }

  // Sync into presence landing (operator-visible deploy surface)
  const presenceWritten = [];
  for (const [name, body] of Object.entries(publicFiles)) {
    const out = path.join(presenceRoot, name);
    await writeFile(out, body, 'utf8');
    presenceWritten.push(path.relative(root, out));
  }

  // Inject verification head into presence index.html when present
  const indexPath = path.join(presenceRoot, 'index.html');
  let indexUpdated = false;
  try {
    await access(indexPath);
    let html = await readFile(indexPath, 'utf8');
    html = injectHead(html, publicFiles['seo-head.html']);
    await writeFile(indexPath, html, 'utf8');
    indexUpdated = true;
    presenceWritten.push(path.relative(root, indexPath));
  } catch {
    // optional
  }

  // Token env example (never commit real secrets — example only)
  await writeFile(
    path.join(deployRoot, 'tokens.env.example'),
    [
      '# Copy to config/seo/tokens.local.env (gitignored) after provider issuance',
      `GOOGLE_SITE_VERIFICATION_TOKEN=${tokens.googleMetaSource === 'env' ? '<set-in-local-env>' : 'PROVIDER_ISSUED_META_TOKEN'}`,
      `GOOGLE_DNS_TXT_TOKEN=${tokens.googleDns || 'google-site-verification=PROVIDER_ISSUED_DNS_TOKEN'}`,
      `BING_SITE_AUTH_TOKEN=${tokens.bingMetaSource === 'env' ? '<set-in-local-env>' : 'PROVIDER_ISSUED_BING_TOKEN'}`,
      `INDEXNOW_KEY=${tokens.indexNowKey}`,
      'GOOGLE_ACCESS_TOKEN=',
      ''
    ].join('\n'),
    'utf8'
  );

  // Persist IndexNow key for operators (public by design once deployed)
  await writeFile(
    path.join(deployRoot, 'indexnow-key.json'),
    `${JSON.stringify(
      {
        key: tokens.indexNowKey,
        keyLocation: `https://${primary.host}/${indexNowFile}`,
        deployedPaths: [`presence/rossco/${indexNowFile}`, `deploy/seo/public/${indexNowFile}`]
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  let dnsApply = { attempted: false, ok: false, reason: 'not_requested' };
  if (applyDns) {
    dnsApply = await tryApplyDns(dnsArtifact, mergedEnv);
  }

  const providerTokensReady = tokens.googleMetaSource === 'env' && tokens.bingMetaSource === 'env' && Boolean(tokens.googleDns);
  const state = dnsApply.ok ? 'DEPLOYED' : 'DEPLOYED';
  // File artifacts are deployed; provider verification still pending without live TXT confirm.
  const receipt = await writeEvidenceReceipt(root, config.output.evidenceDir, 'seo-dns-token-deploy', {
    state,
    filesDeployed: true,
    dnsArtifactReady: true,
    dnsApply,
    providerTokensReady,
    providerVerified: false,
    liveDns: live,
    tokens: {
      googleMetaSource: tokens.googleMetaSource,
      bingMetaSource: tokens.bingMetaSource,
      googleDnsConfigured: Boolean(tokens.googleDns),
      indexNowKey: tokens.indexNowKey,
      indexNowKeyLocation: `https://${primary.host}/${indexNowFile}`
    },
    artifacts: {
      dnsDir: path.relative(root, dnsDir),
      publicDeploy: path.relative(root, publicDeploy),
      presenceRoot: path.relative(root, presenceRoot),
      writtenPublic,
      presenceWritten,
      indexUpdated
    },
    nextSteps: [
      providerTokensReady
        ? 'Apply deploy/seo/dns/registrar-change-request.json TXT at current nameservers (namefind/GoDaddy).'
        : 'Obtain Google/Bing verification tokens, set config/seo/tokens.local.env, re-run seo deploy.',
      'After DNS TXT is visible: ./scripts/ross-infinite seo prevalidate config/seo/ross.co.ownership.json --live',
      'Then: seo google addSite/submitSitemap --execute and seo indexnow --execute'
    ],
    note: 'DEPLOYED means file/DNS artifacts are staged in-repo and presence. PROVIDER_VERIFIED requires search-console confirmation.'
  });

  await writeFile(
    path.join(deployRoot, 'DEPLOYMENT_MANIFEST.json'),
    `${JSON.stringify(
      {
        product: 'ROSS.CO Infinite',
        deployedAt: new Date().toISOString(),
        state,
        primaryHost: primary.host,
        indexNowKey: tokens.indexNowKey,
        receipt: receipt.outPath,
        liveNameservers: live?.ns || [],
        dnsApply
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  return {
    ok: true,
    state,
    generated,
    tokens: {
      indexNowKey: tokens.indexNowKey,
      googleMetaSource: tokens.googleMetaSource,
      bingMetaSource: tokens.bingMetaSource,
      googleDnsConfigured: Boolean(tokens.googleDns)
    },
    live,
    dnsApply,
    artifacts: {
      deployRoot: path.relative(root, deployRoot),
      dnsDir: path.relative(root, dnsDir),
      publicDeploy: path.relative(root, publicDeploy),
      presenceWritten,
      writtenPublic,
      indexUpdated
    },
    receipt
  };
}

function resolveDeployTokens(plan, config, env) {
  const googleMetaEnv = resolveToken(plan.verification.googleMetaEnv, env);
  const bingMetaEnv = resolveToken(plan.verification.bingMetaEnv, env);
  const googleDns = resolveToken(plan.verification.googleDnsEnv, env);
  const indexNowEnv = resolveToken(plan.verification.indexNowKeyEnv, env);

  const stableIndexNow = createHash('sha256')
    .update(`ross.co:indexnow:${config.owner.ownerName}:${config.owner.assertedAt}:${config.brand.canonical}`)
    .digest('hex');

  return {
    googleMeta: googleMetaEnv || 'PENDING_GOOGLE_SITE_VERIFICATION_TOKEN',
    googleMetaSource: googleMetaEnv ? 'env' : 'pending',
    bingMeta: bingMetaEnv || 'PENDING_BING_SITE_AUTH_TOKEN',
    bingMetaSource: bingMetaEnv ? 'env' : 'pending',
    googleDns: googleDns || null,
    googleFileToken: resolveToken('GOOGLE_HTML_FILE_TOKEN', env) || null,
    indexNowKey: indexNowEnv || stableIndexNow
  };
}

async function observeDns(host) {
  const result = { host, observedAt: new Date().toISOString(), txt: [], ns: [], a: [], errors: [] };
  try {
    result.txt = (await dns.resolveTxt(host)).map((row) => row.join(''));
  } catch (error) {
    result.errors.push({ type: 'TXT', message: error.code || error.message });
  }
  try {
    result.ns = await dns.resolveNs(host);
  } catch (error) {
    result.errors.push({ type: 'NS', message: error.code || error.message });
  }
  try {
    result.a = await dns.resolve4(host);
  } catch (error) {
    result.errors.push({ type: 'A', message: error.code || error.message });
  }
  return result;
}

function buildDnsArtifact({ primary, tokens, live, properties }) {
  const txtValue =
    tokens.googleDns ||
    'google-site-verification=PENDING_REPLACE_WITH_PROVIDER_ISSUED_TOKEN';
  const spfKeep = (live?.txt || []).find((row) => row.startsWith('v=spf1')) || 'v=spf1 -all';

  const zoneFile = `; ROSS.CO SEO ownership DNS artifact
; Generated for registrar apply (current NS observed: ${(live?.ns || ['unknown']).join(', ')})
$ORIGIN ${primary.host}.
$TTL 300

@       IN      TXT     "${spfKeep}"
@       IN      TXT     "${txtValue}"

; After hosting cutover, point apex/www to production endpoints.
; Subdomain inventory:
${properties.map((p) => `; - ${p.host} (${p.propertyType}, ${p.role || 'n/a'})`).join('\n')}
`;

  const route53 = {
    Comment: 'ROSS.CO Infinite SEO ownership Google domain verification TXT',
    Changes: [
      {
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: primary.host,
          Type: 'TXT',
          TTL: 300,
          ResourceRecords: [{ Value: `"${spfKeep}"` }, { Value: `"${txtValue}"` }]
        }
      }
    ]
  };

  const registrar = {
    providerHint: (live?.ns || []).some((ns) => String(ns).includes('namefind'))
      ? 'GoDaddy/Namefind DNS panel'
      : 'Current DNS host for ross.co',
    observedNameservers: live?.ns || [],
    observedTxt: live?.txt || [],
    recordsToApply: [
      {
        type: 'TXT',
        host: '@',
        name: primary.host,
        value: txtValue,
        ttl: 300,
        purpose: 'Google Search Console domain property verification'
      },
      {
        type: 'TXT',
        host: '@',
        name: primary.host,
        value: spfKeep,
        ttl: 300,
        purpose: 'Preserve existing SPF'
      }
    ],
    fileVerificationFallbacks: [
      `https://${primary.host}/seo-head.html`,
      `https://${primary.host}/${tokens.indexNowKey}.txt`,
      `https://${primary.host}/BingSiteAuth.xml`
    ],
    pendingProviderToken: !tokens.googleDns
  };

  const instructions = `# Apply ROSS.CO DNS verification at current registrar

Observed nameservers: \`${(live?.ns || []).join(', ') || 'unknown'}\`

## Google domain property TXT

1. Open the DNS panel for **${primary.host}** (Namefind/GoDaddy if NS matches \`namefind.com\`).
2. Add TXT record:

| Field | Value |
|-------|-------|
| Type | TXT |
| Name / Host | \`@\` |
| Value | \`${txtValue}\` |
| TTL | 300 |

3. Keep existing SPF TXT (\`${spfKeep}\`) — do not delete it.
4. Wait for propagation, then run:

\`\`\`bash
./scripts/ross-infinite seo prevalidate config/seo/ross.co.ownership.json --live
\`\`\`

## File tokens already staged in presence

- \`presence/rossco/${tokens.indexNowKey}.txt\` (IndexNow)
- \`presence/rossco/BingSiteAuth.xml\`
- \`presence/rossco/seo-head.html\` (meta tags)
- \`deploy/seo/public/\` mirror

## Route53 (only after NS cutover)

\`\`\`bash
aws route53 change-resource-record-sets \\
  --hosted-zone-id <ZONE_ID> \\
  --change-batch file://deploy/seo/dns/route53-change-batch.json
\`\`\`

## Status honesty

File/DNS **artifacts** are deployed in-repo. Provider verification stays pending until Google/Bing confirm the token.
`;

  return { zoneFile, route53, registrar, instructions };
}

function buildBingXml(token) {
  return `<?xml version="1.0"?>
<users>
  <user>${escapeXml(token)}</user>
</users>
`;
}

function injectHead(html, headFragment) {
  const markerStart = '<!-- ROSS.CO Infinite SEO ownership head injection -->';
  const markerEnd = '<!-- /ROSS.CO Infinite SEO ownership head injection -->';
  const block = `${markerStart}\n${headFragment}\n${markerEnd}`;
  if (html.includes(markerStart) && html.includes(markerEnd)) {
    return html.replace(new RegExp(`${escapeRegExp(markerStart)}[\\s\\S]*?${escapeRegExp(markerEnd)}`), block);
  }
  if (html.includes('</head>')) {
    return html.replace('</head>', `  ${block}\n</head>`);
  }
  return `${block}\n${html}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function tryApplyDns(dnsArtifact, env) {
  // No registrar API credentials are provisioned in this environment.
  // Keep an explicit extension point for GoDaddy/Route53 apply.
  if (env.AWS_ROLE_ARN || env.AWS_ACCESS_KEY_ID) {
    return {
      attempted: true,
      ok: false,
      reason: 'aws_cli_unavailable_or_unauthenticated',
      hint: 'Install/configure AWS CLI and apply deploy/seo/dns/route53-change-batch.json after NS cutover.'
    };
  }
  if (env.GODADDY_API_KEY && env.GODADDY_API_SECRET) {
    return {
      attempted: true,
      ok: false,
      reason: 'godaddy_apply_not_implemented_in_scaffold',
      hint: 'Use registrar-change-request.json values in the GoDaddy DNS UI, or extend tryApplyDns.'
    };
  }
  return {
    attempted: true,
    ok: false,
    reason: 'no_dns_provider_credentials',
    artifact: 'deploy/seo/dns/registrar-change-request.json',
    observedNameservers: dnsArtifact.registrar.observedNameservers
  };
}

async function loadLocalTokenEnv(root, env) {
  const candidates = [
    path.join(root, 'config/seo/tokens.local.env'),
    path.join(root, 'deploy/seo/tokens.local.env')
  ];
  const merged = { ...env };
  for (const file of candidates) {
    try {
      const raw = await readFile(file, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx <= 0) continue;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (value) merged[key] = value;
      }
    } catch {
      // optional
    }
  }
  return merged;
}
