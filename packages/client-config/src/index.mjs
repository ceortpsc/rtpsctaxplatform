export const clientIdentityPlaceholders = Object.freeze({
  api: ['API_CLIENT_ID', 'API_CLIENT_SECRET'],
  tds: ['TDS_CLIENT_ID', 'TDS_CLIENT_SECRET'],
  secureTunnel: ['TUNNEL_CLIENT_ID', 'TUNNEL_CLIENT_SECRET', 'APPROVED_TUNNEL_ENDPOINT']
});

export const clientConfigGovernance = [
  'Provision client identifiers through an approved secret-management process.',
  'Do not commit credentials, certificates, or private keys.',
  'Document production approvals before enabling any live integration.'
];
