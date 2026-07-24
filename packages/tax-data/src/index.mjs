// Reference state + county/parish taxation data for RTPSC invoicing operations.
//
// This is a curated stub/reference dataset for sales & use tax on professional
// services. Rates are illustrative for development and calculation demos —
// not a live tax authority feed. Louisiana uses parishes (not counties).

export const TAX_DATA_NOTICE = Object.freeze([
  'Rates are reference/stub data for development and operations demos.',
  'Confirm current rates with the applicable state or local tax authority before production use.',
  'Louisiana subdivisions are parishes; other states use counties (or equivalents).'
]);

/** State-level base rates (percent). */
export const STATE_TAX_RATES = Object.freeze([
  Object.freeze({ code: 'AL', name: 'Alabama', rate: 4.0, localityLabel: 'county' }),
  Object.freeze({ code: 'AR', name: 'Arkansas', rate: 6.5, localityLabel: 'county' }),
  Object.freeze({ code: 'CA', name: 'California', rate: 7.25, localityLabel: 'county' }),
  Object.freeze({ code: 'FL', name: 'Florida', rate: 6.0, localityLabel: 'county' }),
  Object.freeze({ code: 'GA', name: 'Georgia', rate: 4.0, localityLabel: 'county' }),
  Object.freeze({ code: 'LA', name: 'Louisiana', rate: 4.45, localityLabel: 'parish' }),
  Object.freeze({ code: 'MS', name: 'Mississippi', rate: 7.0, localityLabel: 'county' }),
  Object.freeze({ code: 'NY', name: 'New York', rate: 4.0, localityLabel: 'county' }),
  Object.freeze({ code: 'OK', name: 'Oklahoma', rate: 4.5, localityLabel: 'county' }),
  Object.freeze({ code: 'TX', name: 'Texas', rate: 6.25, localityLabel: 'county' })
]);

/**
 * Local (county/parish) additive rates. `kind` is "county" or "parish".
 * Combined rate = state.rate + locality.rate (+ city when present).
 */
export const LOCALITY_TAX_RATES = Object.freeze([
  // Louisiana parishes
  Object.freeze({ state: 'LA', code: 'ORLEANS', name: 'Orleans Parish', kind: 'parish', rate: 5.0, city: 'New Orleans', cityRate: 0 }),
  Object.freeze({ state: 'LA', code: 'JEFFERSON', name: 'Jefferson Parish', kind: 'parish', rate: 4.75, city: null, cityRate: 0 }),
  Object.freeze({ state: 'LA', code: 'EAST_BATON_ROUGE', name: 'East Baton Rouge Parish', kind: 'parish', rate: 5.0, city: 'Baton Rouge', cityRate: 0 }),
  Object.freeze({ state: 'LA', code: 'CADDO', name: 'Caddo Parish', kind: 'parish', rate: 4.6, city: 'Shreveport', cityRate: 0 }),
  Object.freeze({ state: 'LA', code: 'LAFAYETTE', name: 'Lafayette Parish', kind: 'parish', rate: 4.5, city: 'Lafayette', cityRate: 0 }),
  Object.freeze({ state: 'LA', code: 'ST_TAMMANY', name: 'St. Tammany Parish', kind: 'parish', rate: 4.75, city: null, cityRate: 0 }),
  Object.freeze({ state: 'LA', code: 'CALCASIEU', name: 'Calcasieu Parish', kind: 'parish', rate: 5.25, city: 'Lake Charles', cityRate: 0 }),
  // Texas counties
  Object.freeze({ state: 'TX', code: 'HARRIS', name: 'Harris County', kind: 'county', rate: 2.0, city: 'Houston', cityRate: 0 }),
  Object.freeze({ state: 'TX', code: 'DALLAS', name: 'Dallas County', kind: 'county', rate: 2.0, city: 'Dallas', cityRate: 0 }),
  Object.freeze({ state: 'TX', code: 'TRAVIS', name: 'Travis County', kind: 'county', rate: 2.0, city: 'Austin', cityRate: 0 }),
  Object.freeze({ state: 'TX', code: 'BEXAR', name: 'Bexar County', kind: 'county', rate: 1.75, city: 'San Antonio', cityRate: 0 }),
  // California counties
  Object.freeze({ state: 'CA', code: 'LOS_ANGELES', name: 'Los Angeles County', kind: 'county', rate: 2.25, city: 'Los Angeles', cityRate: 0 }),
  Object.freeze({ state: 'CA', code: 'SAN_FRANCISCO', name: 'San Francisco County', kind: 'county', rate: 2.375, city: 'San Francisco', cityRate: 0 }),
  Object.freeze({ state: 'CA', code: 'SAN_DIEGO', name: 'San Diego County', kind: 'county', rate: 1.5, city: null, cityRate: 0 }),
  // New York
  Object.freeze({ state: 'NY', code: 'NEW_YORK', name: 'New York County', kind: 'county', rate: 4.5, city: 'New York', cityRate: 0 }),
  Object.freeze({ state: 'NY', code: 'KINGS', name: 'Kings County', kind: 'county', rate: 4.5, city: 'Brooklyn', cityRate: 0 }),
  // Florida
  Object.freeze({ state: 'FL', code: 'MIAMI_DADE', name: 'Miami-Dade County', kind: 'county', rate: 1.0, city: 'Miami', cityRate: 0 }),
  Object.freeze({ state: 'FL', code: 'ORANGE_FL', name: 'Orange County', kind: 'county', rate: 0.5, city: 'Orlando', cityRate: 0 }),
  // Georgia
  Object.freeze({ state: 'GA', code: 'FULTON', name: 'Fulton County', kind: 'county', rate: 3.0, city: 'Atlanta', cityRate: 0 }),
  // Mississippi
  Object.freeze({ state: 'MS', code: 'HINDS', name: 'Hinds County', kind: 'county', rate: 1.0, city: 'Jackson', cityRate: 0 }),
  // Arkansas
  Object.freeze({ state: 'AR', code: 'PULASKI', name: 'Pulaski County', kind: 'county', rate: 2.0, city: 'Little Rock', cityRate: 0 }),
  // Oklahoma
  Object.freeze({ state: 'OK', code: 'OKLAHOMA', name: 'Oklahoma County', kind: 'county', rate: 3.875, city: 'Oklahoma City', cityRate: 0 }),
  // Alabama
  Object.freeze({ state: 'AL', code: 'JEFFERSON_AL', name: 'Jefferson County', kind: 'county', rate: 3.0, city: 'Birmingham', cityRate: 0 })
]);

export function listStates() {
  return STATE_TAX_RATES.map((s) => ({ ...s }));
}

export function findState(code) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  return STATE_TAX_RATES.find((s) => s.code === normalized) ?? null;
}

export function listLocalities(stateCode) {
  const state = findState(stateCode);
  if (!state) return [];
  return LOCALITY_TAX_RATES.filter((l) => l.state === state.code).map((l) => ({ ...l }));
}

export function findLocality(stateCode, localityCode) {
  if (!stateCode || !localityCode) return null;
  const state = String(stateCode).trim().toUpperCase();
  const code = String(localityCode).trim().toUpperCase().replace(/\s+/g, '_');
  return (
    LOCALITY_TAX_RATES.find((l) => l.state === state && l.code === code) ??
    LOCALITY_TAX_RATES.find(
      (l) =>
        l.state === state &&
        (l.name.toUpperCase().includes(code.replace(/_/g, ' ')) ||
          (l.city && l.city.toUpperCase() === code.replace(/_/g, ' ')))
    ) ??
    null
  );
}

/**
 * Resolve a jurisdiction from free-form or structured input.
 * Accepts { state, locality } codes/names, or a query string.
 */
export function resolveJurisdiction(input = {}) {
  let stateCode = input.state ?? input.stateCode ?? null;
  let localityCode = input.locality ?? input.localityCode ?? input.parish ?? input.county ?? null;
  const query = (input.query ?? input.text ?? '').toString().trim();

  if (query) {
    const upper = query.toUpperCase();
    for (const loc of LOCALITY_TAX_RATES) {
      const hay = `${loc.name} ${loc.city ?? ''} ${loc.code} ${loc.state}`.toUpperCase();
      if (hay.includes(upper) || upper.includes(loc.name.toUpperCase()) || (loc.city && upper.includes(loc.city.toUpperCase()))) {
        stateCode = loc.state;
        localityCode = loc.code;
        break;
      }
    }
    if (!stateCode) {
      for (const st of STATE_TAX_RATES) {
        if (upper === st.code || upper.includes(st.name.toUpperCase())) {
          stateCode = st.code;
          break;
        }
      }
    }
  }

  const state = findState(stateCode);
  if (!state) {
    return {
      found: false,
      state: null,
      locality: null,
      combinedRate: 0,
      breakdown: null,
      notice: TAX_DATA_NOTICE
    };
  }

  const locality = findLocality(state.code, localityCode);
  const stateRate = state.rate;
  const localRate = locality?.rate ?? 0;
  const cityRate = locality?.cityRate ?? 0;
  const combinedRate = round4(stateRate + localRate + cityRate);

  return {
    found: true,
    state: { code: state.code, name: state.name, rate: stateRate, localityLabel: state.localityLabel },
    locality: locality
      ? {
          code: locality.code,
          name: locality.name,
          kind: locality.kind,
          rate: localRate,
          city: locality.city,
          cityRate
        }
      : null,
    combinedRate,
    breakdown: {
      stateRate,
      localRate,
      cityRate,
      combinedRate,
      taxableBasis: 'sales-use-professional-services-reference'
    },
    notice: TAX_DATA_NOTICE
  };
}

/** Calculate tax dollars from a taxable subtotal and a jurisdiction. */
export function calculateSalesTax(taxableAmount, jurisdictionInput = {}) {
  const jurisdiction = resolveJurisdiction(jurisdictionInput);
  const amount = Number(taxableAmount) || 0;
  const rate = jurisdiction.combinedRate;
  const tax = round2((amount * rate) / 100);
  return {
    taxableAmount: round2(amount),
    rate,
    tax,
    jurisdiction,
    calculatedAt: new Date().toISOString()
  };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function round4(n) {
  return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
}
