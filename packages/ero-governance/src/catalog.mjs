/**
 * Tax Practitioner-for-Hire luxury catalog (RTP Master Manual v2.0 excerpt).
 * Starting prices — final pricing requires signed service order.
 */

export const SERVICE_CATALOG = Object.freeze([
  { code: 'TAX-101', category: 'Individual Tax & Concierge', name: 'Private Tax Strategy Consultation', unit: 'Per 60-minute session', price: 249, currency: 'USD', defaultPersona: 'concierge', risk: 'moderate' },
  { code: 'TAX-102', category: 'Individual Tax & Concierge', name: 'Federal W-2 Individual Return', unit: 'Starting at', price: 1399.99, currency: 'USD', defaultPersona: 'intake-specialist', risk: 'high' },
  { code: 'TAX-103', category: 'Individual Tax & Concierge', name: 'Family Credit Return', unit: 'Starting at', price: 1499.99, currency: 'USD', defaultPersona: 'due-diligence-interviewer', risk: 'high' },
  { code: 'TAX-104', category: 'Individual Tax & Concierge', name: 'Self-Employed Schedule C Return', unit: 'Starting at', price: 1429.99, currency: 'USD', defaultPersona: 'intake-specialist', risk: 'high' },
  { code: 'TAX-111', category: 'Individual Tax & Concierge', name: 'IRS Transcript Review', unit: 'Starting at', price: 499, currency: 'USD', defaultPersona: 'efile-status-agent', risk: 'moderate' },
  { code: 'TAX-112', category: 'Individual Tax & Concierge', name: 'Tax Notice Response Package', unit: 'Starting at', price: 999, currency: 'USD', defaultPersona: 'notice-triage-agent', risk: 'high' },
  { code: 'TAX-113', category: 'Individual Tax & Concierge', name: 'Identity Verification Support', unit: 'Starting at', price: 599, currency: 'USD', defaultPersona: 'security-triage-agent', risk: 'critical' },
  { code: 'BTX-201', category: 'Business Tax & Compliance', name: 'Partnership Return - Form 1065', unit: 'Starting at', price: 2499.99, currency: 'USD', defaultPersona: 'intake-specialist', risk: 'high' },
  { code: 'BTX-202', category: 'Business Tax & Compliance', name: 'S Corporation Return - Form 1120-S', unit: 'Starting at', price: 2999.99, currency: 'USD', defaultPersona: 'intake-specialist', risk: 'high' },
  { code: 'BTX-209', category: 'Business Tax & Compliance', name: 'Form 1099 Filing Package', unit: 'Starting at', price: 299, currency: 'USD', defaultPersona: 'document-analyst', risk: 'moderate' },
  { code: 'BKR-301', category: 'Bookkeeping', name: 'Books & Chart of Accounts Setup', unit: 'Starting at', price: 1250, currency: 'USD', defaultPersona: 'bookkeeping-assistant', risk: 'moderate' },
  { code: 'BKR-302', category: 'Bookkeeping', name: 'Essential Monthly Bookkeeping', unit: 'Per month', price: 899, currency: 'USD', defaultPersona: 'bookkeeping-assistant', risk: 'moderate' },
  { code: 'PAY-401', category: 'Payroll & Workforce', name: 'Payroll System Implementation', unit: 'Starting at', price: 899, currency: 'USD', defaultPersona: 'intake-specialist', risk: 'high' },
  { code: 'PAY-402', category: 'Payroll & Workforce', name: 'Managed Payroll Compliance', unit: 'Per month', price: 299.99, currency: 'USD', defaultPersona: 'bookkeeping-assistant', risk: 'high' },
  { code: 'ADV-501', category: 'Business Advisory', name: 'Startup Financial Blueprint', unit: 'Starting at', price: 1499, currency: 'USD', defaultPersona: 'concierge', risk: 'moderate' },
  { code: 'ERO-609', category: 'ERO / Office Ops', name: 'E-File Production Readiness', unit: 'Starting at', price: 2500, currency: 'USD', defaultPersona: 'efile-status-agent', risk: 'high' },
  { code: 'ERO-612', category: 'ERO / Office Ops', name: 'Transmission & Processing Administration', unit: 'Per tax year/return', price: 125.99, currency: 'USD', defaultPersona: 'efile-status-agent', risk: 'high' },
  { code: 'SFT-709', category: 'Software & Automation', name: 'AI Workflow Automation', unit: 'Starting at', price: 10000, currency: 'USD', defaultPersona: 'supervisor-router', risk: 'high' },
  { code: 'TRN-801', category: 'Training', name: 'Private Tax Professional Coaching', unit: 'Per hour', price: 350, currency: 'USD', defaultPersona: 'concierge', risk: 'low' },
  { code: 'DOC-901', category: 'Documents & Ops', name: 'Professional Business or Agency Letter', unit: 'Starting at', price: 250, currency: 'USD', defaultPersona: 'document-analyst', risk: 'moderate' },
  { code: 'DOC-903', category: 'Documents & Ops', name: 'Secure Client Portal Implementation', unit: 'Starting at', price: 1250, currency: 'USD', defaultPersona: 'intake-specialist', risk: 'moderate' },
  { code: 'SEO-1001', category: 'SEO & Presence', name: 'Local SEO Launch', unit: 'Starting at', price: 2500, currency: 'USD', defaultPersona: 'concierge', risk: 'low' }
]);

export function getCatalogItem(code) {
  return SERVICE_CATALOG.find((item) => item.code === code) || null;
}

export function listCatalog({ category } = {}) {
  if (!category) return [...SERVICE_CATALOG];
  return SERVICE_CATALOG.filter((item) => item.category === category);
}
