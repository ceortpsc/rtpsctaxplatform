/** Unified RTPSC enterprise navigation — only implemented modules are linked. */

export const SERVICE_PORTS = Object.freeze({
  'api-gateway': 3000,
  'refund-status': 3001,
  transcript: 3002,
  analytics: 3003,
  enrollment: 3004,
  invoice: 3005,
  'pos-crm': 3006,
  dashboard: 3010,
  'web-portal': 3011,
  'staff-portal': 3012,
  'irs-gateway': 8820,
  'ai-workforce': 8860
});

function localHref(port, path = '/') {
  return `http://localhost:${port}${path}`;
}

/** Navigation sections with implementation status labels. */
export const NAV_SECTIONS = Object.freeze([
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: localHref(3012), status: 'ready', minRole: 'tax_preparer' },
      { id: 'activity', label: 'Activity', status: 'limited', minRole: 'tax_preparer' },
      { id: 'tasks', label: 'Tasks', status: 'limited', minRole: 'tax_preparer' },
      { id: 'notifications', label: 'Notifications', status: 'limited', minRole: 'tax_preparer' }
    ]
  },
  {
    id: 'client-ops',
    label: 'Client Operations',
    items: [
      { id: 'clients', label: 'Clients', href: localHref(3006), status: 'ready', minRole: 'tax_preparer' },
      { id: 'leads', label: 'Leads', status: 'limited', minRole: 'tax_preparer' },
      { id: 'intake', label: 'Intake', status: 'limited', minRole: 'tax_preparer' },
      { id: 'communications', label: 'Communications', status: 'limited', minRole: 'tax_preparer' },
      { id: 'documents', label: 'Documents', status: 'limited', minRole: 'tax_preparer' }
    ]
  },
  {
    id: 'tax-ops',
    label: 'Tax Operations',
    items: [
      { id: 'returns', label: 'Tax Returns', status: 'blocked_dependency', minRole: 'tax_preparer' },
      { id: 'efile', label: 'E-file', href: localHref(8820), status: 'blocked_credentials', minRole: 'ero' },
      { id: 'transcripts', label: 'Transcripts', href: localHref(3002), status: 'limited', minRole: 'tax_preparer' },
      { id: 'refunds', label: 'Refund Center', href: localHref(3001), status: 'ready', minRole: 'tax_preparer' },
      { id: 'compliance', label: 'Compliance Review', status: 'limited', minRole: 'reviewer' }
    ]
  },
  {
    id: 'financial',
    label: 'Financial Operations',
    items: [
      { id: 'invoices', label: 'Invoices', href: localHref(3005), status: 'ready', minRole: 'billing_specialist' },
      { id: 'payments', label: 'Payments', status: 'limited', minRole: 'billing_specialist' },
      { id: 'enrollment', label: 'Refund Advance', href: localHref(3004), status: 'ready', minRole: 'billing_specialist' },
      { id: 'pos', label: 'POS Checkout', href: localHref(3006), status: 'ready', minRole: 'bookkeeper' },
      { id: 'reports', label: 'Financial Reports', href: localHref(3003), status: 'limited', minRole: 'office_manager' }
    ]
  },
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      { id: 'approvals', label: 'Approvals', status: 'limited', minRole: 'reviewer' },
      { id: 'assignments', label: 'Assignments', status: 'limited', minRole: 'office_manager' },
      { id: 'automations', label: 'Automations', status: 'limited', minRole: 'office_manager' }
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'modules', label: 'Module Catalog', href: localHref(3010), status: 'ready', minRole: 'platform_admin' },
      { id: 'ai-workforce', label: 'AI Workforce', href: localHref(8860), status: 'ready', minRole: 'platform_admin' },
      { id: 'settings', label: 'System Settings', status: 'limited', minRole: 'platform_admin' },
      { id: 'security', label: 'Security', status: 'limited', minRole: 'platform_admin' }
    ]
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { id: 'help', label: 'Help Center', href: localHref(3011, '/docs'), status: 'ready', minRole: 'client' },
      { id: 'status', label: 'System Status', href: localHref(3011, '/status'), status: 'ready', minRole: 'client' },
      { id: 'design-system', label: 'Design System', href: localHref(3012, '/design-system'), status: 'ready', minRole: 'tax_preparer' }
    ]
  }
]);

export function flattenNavItems(sections = NAV_SECTIONS) {
  const items = [];
  for (const section of sections) {
    for (const item of section.items) {
      items.push({ ...item, section: section.label, sectionId: section.id });
    }
  }
  return items;
}

export function getNavJson(userRole = 'tax_preparer') {
  return { sections: NAV_SECTIONS, role: userRole, generatedAt: new Date().toISOString() };
}
