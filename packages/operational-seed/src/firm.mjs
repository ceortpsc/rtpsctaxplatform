import { PLATFORM_IDENTITY, loadRuntimeConfig, redactConfig } from '../../platform-core/src/index.mjs';

function trim(value) {
  const s = String(value ?? '').trim();
  return s || null;
}

function isConfigured(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s || s === 'unset') return false;
  if (s.startsWith('replace-via-') || s.startsWith('replace-in-')) return false;
  return true;
}

function redactHint(value, keepStart = 3, keepEnd = 2) {
  const s = String(value ?? '');
  if (!isConfigured(s)) return 'unset';
  if (s.length <= keepStart + keepEnd + 2) return `${s.slice(0, Math.min(2, s.length))}***`;
  const head = s.slice(0, keepStart);
  const tail = keepEnd > 0 ? s.slice(-keepEnd) : '';
  return `${head}***${tail}`;
}

/**
 * Firm + ERO identity from PLATFORM_IDENTITY and operator-provisioned env.
 * Never invents demo clients or placeholder taxpayer PII.
 */
export function loadFirmIdentity(env = process.env) {
  const config = loadRuntimeConfig({
    appEnv: env.APP_ENV,
    nodeEnv: env.NODE_ENV,
    apiClientId: env.API_CLIENT_ID,
    apiClientSecret: env.API_CLIENT_SECRET,
    tdsClientId: env.TDS_CLIENT_ID,
    tdsClientSecret: env.TDS_CLIENT_SECRET,
    tunnelClientId: env.TUNNEL_CLIENT_ID,
    tunnelClientSecret: env.TUNNEL_CLIENT_SECRET,
    approvedTunnelEndpoint: env.APPROVED_TUNNEL_ENDPOINT,
    efileTransmissionEnabled: env.EFILE_TRANSMISSION_ENABLED === 'true',
    eroPtin: env.ERO_PTIN ?? env.PTIN,
    eroCaf: env.ERO_CAF_NUMBER ?? env.CAF_NUMBER,
    efin: env.EFIN,
    etin: env.ETIN
  });
  const legalName = trim(env.FIRM_LEGAL_NAME) || PLATFORM_IDENTITY.company;
  const application = trim(env.FIRM_APPLICATION) || PLATFORM_IDENTITY.application;
  const email = trim(env.FIRM_EMAIL) || trim(env.OPERATOR_EMAIL);
  const operatorName = trim(env.OPERATOR_NAME);
  const operatorEmail = trim(env.OPERATOR_EMAIL) || email;
  const addressLine1 = trim(env.FIRM_ADDRESS_LINE1);
  const city = trim(env.FIRM_CITY);
  const state = trim(env.FIRM_STATE)?.toUpperCase() || null;
  const postal = trim(env.FIRM_POSTAL);
  const phone = trim(env.FIRM_PHONE);
  const registerId = trim(env.POS_REGISTER_ID) || 'REG-RTPSC-1';
  const cashierId = trim(env.POS_CASHIER_ID) || (isConfigured(config.eroPtin) ? `ero-${String(config.eroPtin).toLowerCase()}` : 'ero-operator');

  const addressParts = [addressLine1, [city, state].filter(Boolean).join(', '), postal].filter(Boolean);
  const address = addressParts.length ? addressParts.join(', ') : null;

  const eroConfigured = [config.eroPtin, config.eroCaf, config.efin, config.etin].some(isConfigured);

  return {
    company: legalName,
    application,
    abbreviation: PLATFORM_IDENTITY.abbreviation,
    email,
    phone,
    address,
    addressLine1,
    city,
    state,
    postal,
    operator: operatorName
      ? {
          name: operatorName,
          email: operatorEmail,
          role: 'ero',
          form8821: trim(env.OPERATOR_FORM_8821) || '8821',
          source: 'env'
        }
      : null,
    pos: {
      registerId,
      cashierId
    },
    ero: {
      configured: eroConfigured,
      ptin: redactHint(config.eroPtin, 4, 0),
      caf: redactHint(config.eroCaf, 3, 3),
      efin: isConfigured(config.efin) ? redactHint(config.efin, 2, 2) : 'unset',
      etin: isConfigured(config.etin) ? redactHint(config.etin, 2, 2) : 'unset',
      ptinConfigured: isConfigured(config.eroPtin),
      cafConfigured: isConfigured(config.eroCaf)
    },
    runtime: redactConfig(config),
    completeness: {
      firmEmail: Boolean(email),
      operator: Boolean(operatorName),
      address: Boolean(addressLine1 && city && state && postal),
      ero: eroConfigured
    }
  };
}
