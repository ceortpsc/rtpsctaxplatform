/**
 * Custom XHTML / XML builders for RTPSC tax practitioner (ERO) payloads.
 * Well-formed XML only — not live MeF transmission. Fail-safe scaffolding.
 */

import { PLATFORM_IDENTITY } from '../../platform-core/src/index.mjs';

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function xmlDeclaration(encoding = 'UTF-8') {
  return `<?xml version="1.0" encoding="${encoding}"?>`;
}

export function isWellFormedXml(xml) {
  const text = String(xml ?? '');
  if (!text.includes('<') || !text.includes('>')) return false;
  const open = [...text.matchAll(/<([A-Za-z_][\w:.-]*)\b[^/>]*\/?>/g)].map((m) => m[1]);
  const close = [...text.matchAll(/<\/([A-Za-z_][\w:.-]*)>/g)].map((m) => m[1]);
  if (!open.length) return false;
  // Lightweight balance check for non-void style tags
  const stack = [];
  const tokens = text.match(/<\/?[A-Za-z_][\w:.-]*[^>]*>/g) || [];
  for (const tok of tokens) {
    if (tok.startsWith('<?') || tok.startsWith('<!')) continue;
    if (tok.endsWith('/>')) continue;
    if (tok.startsWith('</')) {
      const name = tok.slice(2, -1).trim().split(/\s/)[0];
      const top = stack.pop();
      if (top !== name) return false;
    } else {
      const name = tok.slice(1, -1).trim().split(/\s/)[0];
      stack.push(name);
    }
  }
  return stack.length === 0 && close.length >= 0;
}

function attrs(map = {}) {
  return Object.entries(map)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('');
}

export function buildXhtmlDocument({ title, bodyHtml, lang = 'en' } = {}) {
  const safeTitle = escapeXml(title || `${PLATFORM_IDENTITY.abbreviation} Practitioner Document`);
  return `${xmlDeclaration()}
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">
<head>
  <meta http-equiv="Content-Type" content="application/xhtml+xml; charset=UTF-8" />
  <title>${safeTitle}</title>
</head>
<body>
${bodyHtml || '<p>Empty practitioner document.</p>'}
</body>
</html>
`;
}

/** Practitioner account / CAF / PTIN profile XML (redacted fields expected upstream). */
export function buildPractitionerAccountXml(account = {}) {
  return `${xmlDeclaration()}
<TaxPractitionerAccount xmlns="urn:rtpsc:irs:practitioner:v1" company="${escapeXml(PLATFORM_IDENTITY.company)}">
  <Application>${escapeXml(PLATFORM_IDENTITY.application)}</Application>
  <Representative>
    <Name>${escapeXml(account.name)}</Name>
    <Form8821Status>${escapeXml(account.form8821Status || 'on-file')}</Form8821Status>
    <CAFNumber>${escapeXml(account.cafRedacted || account.cafNumber || 'unset')}</CAFNumber>
    <PTIN>${escapeXml(account.ptinRedacted || account.ptin || 'unset')}</PTIN>
    <EFIN>${escapeXml(account.efinRedacted || account.efin || 'unset')}</EFIN>
    <ETIN>${escapeXml(account.etinRedacted || account.etin || 'unset')}</ETIN>
    <Jurisdiction>${escapeXml(account.state || '')}</Jurisdiction>
  </Representative>
  <Integrations>
    <ApiClient configured="${account.apiClientConfigured === true ? 'true' : 'false'}"/>
    <TdsClient configured="${account.tdsClientConfigured === true ? 'true' : 'false'}"/>
    <IrsOAuth configured="${account.irsOAuthConfigured === true ? 'true' : 'false'}"/>
  </Integrations>
  <Notice>Secrets never embedded. Live IRS calls require production gates + approved tunnel.</Notice>
</TaxPractitionerAccount>
`;
}

/** Masterfile TC rectification payload (570 hold / 810 credit elect). */
export function buildMasterfileRectificationXml(input = {}) {
  const codes = Array.isArray(input.transactionCodes) ? input.transactionCodes : [];
  const codeXml = codes
    .map(
      (c) => `    <TransactionCode code="${escapeXml(c.code)}" action="${escapeXml(c.action || 'review')}">
      <Label>${escapeXml(c.label || '')}</Label>
      <Status>${escapeXml(c.status || 'open')}</Status>
      <Rectified>${c.rectified === true ? 'true' : 'false'}</Rectified>
      <Notes>${escapeXml(c.notes || '')}</Notes>
    </TransactionCode>`
    )
    .join('\n');

  return `${xmlDeclaration()}
<MasterfileRectification xmlns="urn:rtpsc:irs:masterfile:v1"${attrs({
    caseId: input.caseId,
    taxpayerRef: input.taxpayerRef
  })}>
  <Pipeline>masterfile-pipeline</Pipeline>
  <LiveIrsAdjustmentsApplied>${input.liveIrsApplied === true ? 'true' : 'false'}</LiveIrsAdjustmentsApplied>
  <TransactionCodes>
${codeXml || '    <!-- none -->'}
  </TransactionCodes>
  <Rectification>
    <Status>${escapeXml(input.rectificationStatus || 'pending')}</Status>
    <ResolvedHolds>${escapeXml((input.resolvedHolds || []).join(','))}</ResolvedHolds>
    <Operator>${escapeXml(input.operator || 'ero')}</Operator>
    <At>${escapeXml(input.at || new Date().toISOString())}</At>
  </Rectification>
</MasterfileRectification>
`;
}

/** Refund release request after hold rectification. */
export function buildRefundReleaseRequestXml(input = {}) {
  return `${xmlDeclaration()}
<RefundReleaseRequest xmlns="urn:rtpsc:irs:refund-release:v1"${attrs({
    requestId: input.requestId,
    caseId: input.caseId,
    taxpayerRef: input.taxpayerRef
  })}>
  <Amount currency="USD">${escapeXml(input.amount ?? '')}</Amount>
  <Prerequisite>
    <MasterfileRectified>${input.masterfileRectified === true ? 'true' : 'false'}</MasterfileRectified>
    <ClearedCodes>${escapeXml((input.clearedCodes || []).join(','))}</ClearedCodes>
    <IntelligenceBand>${escapeXml(input.intelligenceBand || '')}</IntelligenceBand>
    <GuardLevel>${escapeXml(input.guardLevel || '')}</GuardLevel>
  </Prerequisite>
  <RequestedBy>${escapeXml(input.requestedBy || 'ero')}</RequestedBy>
  <RequestedAt>${escapeXml(input.requestedAt || new Date().toISOString())}</RequestedAt>
  <TransmissionAllowed>${input.transmissionAllowed === true ? 'true' : 'false'}</TransmissionAllowed>
  <Notice>Release remains blocked until production gates + approved IRS tunnel clear.</Notice>
</RefundReleaseRequest>
`;
}

/** Post-release reconciliation footprint. */
export function buildRefundReconciliationXml(input = {}) {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const lineXml = lines
    .map(
      (l) =>
        `    <Line type="${escapeXml(l.type)}" amount="${escapeXml(l.amount ?? 0)}">${escapeXml(l.detail || '')}</Line>`
    )
    .join('\n');
  return `${xmlDeclaration()}
<RefundReconciliation xmlns="urn:rtpsc:irs:refund-reconcile:v1"${attrs({
    reconciliationId: input.reconciliationId,
    caseId: input.caseId,
    releaseRequestId: input.releaseRequestId
  })}>
  <Status>${escapeXml(input.status || 'open')}</Status>
  <Approved>${input.approved === true ? 'true' : 'false'}</Approved>
  <Issued>${input.issued === true ? 'true' : 'false'}</Issued>
  <TC846Posted>${input.tc846Posted === true ? 'true' : 'false'}</TC846Posted>
  <Lines>
${lineXml || '    <!-- none -->'}
  </Lines>
  <Balanced>${input.balanced === true ? 'true' : 'false'}</Balanced>
  <At>${escapeXml(input.at || new Date().toISOString())}</At>
</RefundReconciliation>
`;
}

/** XHTML operator summary for ERO suite. */
export function buildPractitionerSuiteXhtml(summary = {}) {
  const rows = (summary.modules || [])
    .map((m) => `<tr><td>${escapeXml(m.name)}</td><td>${escapeXml(m.status)}</td><td>${escapeXml(m.detail || '')}</td></tr>`)
    .join('\n');
  const body = `
  <h1>${escapeXml(PLATFORM_IDENTITY.company)} — Tax Practitioner Suite</h1>
  <p>Case <strong>${escapeXml(summary.caseId || 'n/a')}</strong> · Taxpayer ref <strong>${escapeXml(summary.taxpayerRef || 'n/a')}</strong></p>
  <h2>Integration posture</h2>
  <ul>
    <li>API client: ${escapeXml(summary.apiClient || 'unset')}</li>
    <li>TDS client: ${escapeXml(summary.tdsClient || 'unset')}</li>
    <li>IRS OAuth: ${escapeXml(summary.irsOAuth || 'unset')}</li>
  </ul>
  <h2>Modules</h2>
  <table border="1" cellpadding="4" cellspacing="0">
    <thead><tr><th>Module</th><th>Status</th><th>Detail</th></tr></thead>
    <tbody>
${rows || '<tr><td colspan="3">No modules listed.</td></tr>'}
    </tbody>
  </table>
  <p><em>Human-in-the-loop required. No unauthorized IRS access.</em></p>`;
  return buildXhtmlDocument({ title: 'Tax Practitioner Suite', bodyHtml: body });
}

export const IRS_XML_NAMESPACES = Object.freeze({
  practitioner: 'urn:rtpsc:irs:practitioner:v1',
  masterfile: 'urn:rtpsc:irs:masterfile:v1',
  release: 'urn:rtpsc:irs:refund-release:v1',
  reconcile: 'urn:rtpsc:irs:refund-reconcile:v1'
});
