export const clientIdentityPlaceholders = Object.freeze({
  api: ['API_CLIENT_ID', 'API_CLIENT_SECRET'],
  tds: ['TDS_CLIENT_ID', 'TDS_CLIENT_SECRET'],
  secureTunnel: [
    'TUNNEL_CLIENT_ID',
    'TUNNEL_CLIENT_SECRET',
    'APPROVED_TUNNEL_ENDPOINT',
    'APPROVED_TUNNEL_ENDPOINT_SECONDARY'
  ],
  transmitter: ['EFIN', 'ETIN', 'ERO_PTIN', 'ERO_CAF_NUMBER'],
  irs: [
    'IRS_CLIENT_ID_PRIMARY',
    'IRS_CLIENT_SECRET_PRIMARY',
    'IRS_PRIVATE_KEY_PATH_PRIMARY',
    'IRS_KEY_ID_PRIMARY',
    'IRS_CLIENT_ID_SECONDARY',
    'IRS_CLIENT_SECRET_SECONDARY',
    'IRS_PRIVATE_KEY_PATH_SECONDARY',
    'IRS_TOKEN_URL',
    'IRS_SCOPE'
  ]
});

export const clientConfigGovernance = [
  'Provision client identifiers through an approved secret-management process.',
  'Do not commit credentials, certificates, or private keys.',
  'Document production approvals before enabling any live integration.'
];
