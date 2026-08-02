const SOURCE_TYPES = Object.freeze([
  'prior-tax-software-export',
  'csv-client-roster',
  'document-bundle',
  'manual-client-onboarding'
]);

function clean(value, fallback = '') {
  return String(value ?? fallback).trim();
}

export function buildClientImportMessage({
  firmName = 'Ross Tax Pro Software Co',
  recipientName = 'Client',
  portalUrl = '/client-import',
  expiresIn = '72 hours'
} = {}) {
  return [
    `Hello ${clean(recipientName, 'Client')},`,
    '',
    `${clean(firmName, 'Ross Tax Pro Software Co')} has prepared a secure client-import request for you.`,
    `Open the authenticated portal at ${clean(portalUrl, '/client-import')} and sign in before uploading any records.`,
    '',
    'Do not email or text Social Security numbers, tax returns, identity documents, banking information, or unencrypted client exports.',
    `The secure request expires in ${clean(expiresIn, '72 hours')}. Uploaded records remain in validation status until an authorized human reviewer approves the import.`,
    '',
    'The portal will report accepted rows, rejected rows, duplicate candidates, missing required fields, and any records held for manual review.',
    '',
    'Ross Tax Pro Software Co'
  ].join('\n');
}

export function evaluateImportRequest({ sourceType, recordCount, taxpayerConsent, encryptedTransfer } = {}) {
  const normalizedSource = clean(sourceType);
  const count = Number(recordCount);
  const issues = [];
  if (!SOURCE_TYPES.includes(normalizedSource)) issues.push('unsupported_source_type');
  if (!Number.isInteger(count) || count < 1 || count > 10000) issues.push('invalid_record_count');
  if (taxpayerConsent !== true) issues.push('taxpayer_consent_required');
  if (encryptedTransfer !== true) issues.push('encrypted_transfer_required');
  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? 'READY_FOR_SECURE_UPLOAD' : 'HOLD',
    issues,
    controls: [
      'AUTHENTICATED_PORTAL_SESSION',
      'MALWARE_SCAN',
      'FILE_TYPE_VALIDATION',
      'ROW_LEVEL_VALIDATION',
      'DUPLICATE_DETECTION',
      'HUMAN_IMPORT_APPROVAL',
      'AUDIT_RECEIPT'
    ]
  };
}

export const CLIENT_IMPORT_SOURCE_TYPES = SOURCE_TYPES;
