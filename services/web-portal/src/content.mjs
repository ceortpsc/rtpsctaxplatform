// Shared site content for the RTPSC web portal (used by pages + XML surfaces).

export const SITE = Object.freeze({
  name: 'Ross Tax Pro Software Co',
  product: 'Efile Transmission Software',
  short: 'RTPSC',
  tagline: 'New-era e-file transmission, refund intelligence, and operator tooling — signal-clear from first viewport to XML rollout.',
  baseUrlEnv: 'PORTAL_PUBLIC_URL'
});

/** Primary navigation (also feeds the sitemap). */
export const NAV = Object.freeze([
  { path: '/', label: 'Home' },
  { path: '/platform', label: 'Platform' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/status', label: 'Status' },
  { path: '/docs', label: 'Docs' },
  { path: '/register', label: 'Register' },
  { path: '/signin', label: 'Sign in' }
]);

/** Feature cards shown on the platform page. */
export const FEATURES = Object.freeze([
  {
    key: 'refund',
    title: 'Refund Center',
    body: 'Event-driven refund cases, pipeline stages, and a local refund-intelligence timeline.',
    service: 'refund-status-service',
    port: 3001
  },
  {
    key: 'invoice',
    title: 'Invoicing Machine',
    body: 'AI-assisted data entry, state + parish tax calculation, and PDF / receipt-paper export.',
    service: 'invoice-service',
    port: 3005
  },
  {
    key: 'poscrm',
    title: 'POS + CRM',
    body: 'Point-of-sale checkout settling through the invoicing core, with a CRM interaction timeline.',
    service: 'pos-crm-service',
    port: 3006
  },
  {
    key: 'enrollment',
    title: 'Bank Products',
    body: 'SBTPG refund-advance enrollment behind a fail-safe payment gate and audited operator login.',
    service: 'enrollment-service',
    port: 3004
  },
  {
    key: 'gateway',
    title: 'API Gateway',
    body: 'Authenticated ingress that issues client tokens and proxies approved refund routes.',
    service: 'api-gateway',
    port: 3000
  },
  {
    key: 'dashboard',
    title: 'Modules Dashboard',
    body: 'Read-only catalog of every platform module with insights and a dependency graph.',
    service: 'modules-dashboard',
    port: 3010
  }
]);

/** Membership tiers shown on the pricing page. */
export const TIERS = Object.freeze([
  {
    key: 'starter',
    name: 'Starter',
    price: '$0',
    cadence: 'local dev',
    highlights: ['All operator UIs', 'Local persistent datastore', 'Community docs'],
    cta: 'Create account'
  },
  {
    key: 'pro',
    name: 'Professional',
    price: '$149',
    cadence: 'per seat / mo',
    highlights: ['Everything in Starter', 'API + TDS client credentials', 'Refund intelligence scoring'],
    cta: 'Create account',
    featured: true
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Contact',
    cadence: 'custom',
    highlights: ['Everything in Professional', 'SBTPG bank products', 'Dedicated compliance sign-off'],
    cta: 'Create account'
  }
]);

/** Services probed by the /status page + /api/status endpoint. */
export const SERVICE_TARGETS = Object.freeze([
  { name: 'api-gateway', port: 3000 },
  { name: 'refund-status-service', port: 3001 },
  { name: 'transcript-service', port: 3002 },
  { name: 'analytics-service', port: 3003 },
  { name: 'enrollment-service', port: 3004 },
  { name: 'invoice-service', port: 3005 },
  { name: 'pos-crm-service', port: 3006 },
  { name: 'modules-dashboard', port: 3010 }
]);

/** Documentation links surfaced on the /docs page. */
export const DOC_LINKS = Object.freeze([
  { title: 'Web Portal (XHTML/XML)', href: 'https://github.com/ceortpsc/rtpsctaxplatform/blob/main/docs/web-portal.md' },
  { title: 'Signal Era Design System', href: 'https://github.com/ceortpsc/rtpsctaxplatform/blob/main/docs/design-system.md' },
  { title: 'Architecture', href: 'https://github.com/ceortpsc/rtpsctaxplatform/blob/main/docs/architecture.md' },
  { title: 'API Spec Overview', href: 'https://github.com/ceortpsc/rtpsctaxplatform/blob/main/docs/api-spec-overview.md' },
  { title: 'Engineering Standards', href: 'https://github.com/ceortpsc/rtpsctaxplatform/blob/main/docs/engineering-standards.md' },
  { title: 'Operations Runbook', href: 'https://github.com/ceortpsc/rtpsctaxplatform/blob/main/docs/operations-runbook.md' }
]);

/** Resolve the public base URL for absolute links (sitemap/feed/canonical). */
export function baseUrl(config = {}) {
  const envUrl = process.env[SITE.baseUrlEnv];
  if (envUrl) return envUrl.replace(/\/$/, '');
  const port = config.servicePort ?? 3011;
  return `http://localhost:${port}`;
}
