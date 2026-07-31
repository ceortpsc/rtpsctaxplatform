export const PRODUCT_CATEGORIES = Object.freeze([
  { id: 'command', label: 'Command Center', icon: '◈' },
  { id: 'client', label: 'Client Experience', icon: '◎' },
  { id: 'tax', label: 'Tax Operations', icon: '△' },
  { id: 'finance', label: 'Financial Operations', icon: '◇' },
  { id: 'intelligence', label: 'Intelligence & Automation', icon: '✦' },
  { id: 'governance', label: 'Governance & Security', icon: '⬡' },
  { id: 'platform', label: 'Platform Tools', icon: '⌘' }
]);

export const PRODUCT_CATALOG = Object.freeze([
  { id: 'staff-command', name: 'Staff Command Center', category: 'command', href: 'http://localhost:3012/', status: 'ready', minRole: 'tax_preparer', features: ['role dashboard','priority queue','quick actions','cross-product navigation'] },
  { id: 'module-control', name: 'Module Control Center', category: 'command', href: 'http://localhost:3010/', status: 'ready', minRole: 'platform_admin', features: ['catalog','dependency graph','AI advisor','service status','favorites'] },
  { id: 'client-portal', name: 'Secure Client Portal', category: 'client', href: 'http://localhost:3011/', status: 'ready', minRole: 'client', features: ['Cognito access','account workspace','EFIN onboarding','secure client import','status center'] },
  { id: 'crm', name: 'Client CRM', category: 'client', href: 'http://localhost:3006/', status: 'ready', minRole: 'tax_preparer', features: ['clients','leads','communications','checkout'] },
  { id: 'refund-center', name: 'Refund Intelligence Center', category: 'tax', href: 'http://localhost:3001/', status: 'ready', minRole: 'tax_preparer', features: ['refund lanes','case status','hold posture','workflow routing'] },
  { id: 'transcript-center', name: 'Transcript Center', category: 'tax', href: 'http://localhost:3002/', status: 'limited', minRole: 'tax_preparer', features: ['catalog','pull requests','authorization gates','audit events'] },
  { id: 'efile-gateway', name: 'E-file Gateway', category: 'tax', href: 'http://localhost:8820/', status: 'blocked_credentials', minRole: 'ero', features: ['transmission contracts','acknowledgment model','fail-closed controls'] },
  { id: 'invoice', name: 'Invoice Studio', category: 'finance', href: 'http://localhost:3005/', status: 'ready', minRole: 'billing_specialist', features: ['invoice builder','PDF output','status tracking'] },
  { id: 'enrollment', name: 'Enrollment & Bank Products', category: 'finance', href: 'http://localhost:3004/', status: 'ready', minRole: 'billing_specialist', features: ['provider enrollment','product readiness','controlled activation'] },
  { id: 'analytics', name: 'Analytics Center', category: 'intelligence', href: 'http://localhost:3003/', status: 'limited', minRole: 'office_manager', features: ['metrics','feeds','TC codes','aggregation'] },
  { id: 'ai-workforce', name: 'Ross AI Workforce', category: 'intelligence', href: 'http://localhost:8860/', status: 'ready', minRole: 'platform_admin', features: ['AI employees','assisted inquiry','human review gates'] },
  { id: 'security', name: 'Security Operations', category: 'governance', href: 'http://localhost:3000/security', status: 'ready_scaffold', minRole: 'platform_admin', features: ['security posture','secret readiness','rate limits','audit evidence'] },
  { id: 'release-manager', name: 'Release Manager', category: 'governance', href: '/docs/releases/v2.0-release-channels.md', status: 'ready', minRole: 'platform_admin', features: ['eight channels','promotion controls','immutable tags','release evidence'] },
  { id: 'design-system', name: 'Signal Era Design System', category: 'platform', href: 'http://localhost:3012/design-system', status: 'ready', minRole: 'tax_preparer', features: ['tokens','components','logos','accessibility','responsive patterns'] },
  { id: 'brand-kit', name: 'Brand Asset Studio', category: 'platform', href: 'http://localhost:3012/design-system#brand-kit', status: 'ready', minRole: 'office_manager', features: ['SVG','PNG','ICO','download-safe assets'] }
]);

export function getProduct(id) { return PRODUCT_CATALOG.find((product) => product.id === id) ?? null; }
export function productsByCategory(category) { return PRODUCT_CATALOG.filter((product) => product.category === category); }
export function productSearch(query = '') {
  const terms = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...PRODUCT_CATALOG];
  return PRODUCT_CATALOG.filter((product) => {
    const haystack = [product.name, product.category, product.status, ...(product.features || [])].join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
