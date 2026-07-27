import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UI_SYSTEM_ROOT = path.resolve(__dirname, '..');
export const UI_SYSTEM_PUBLIC = path.join(UI_SYSTEM_ROOT, 'public');

export const PLATFORM_BRAND = {
  shortName: 'RTPSC',
  legalName: 'Ross Tax Pro Software Co',
  productName: 'RTPSC Tax Platform',
  tagline: 'Enterprise tax operations · billing · compliance',
  monogramPath: '/shared/brand/marks/monogram.svg',
  wordmarkPath: '/shared/brand/logos/wordmark-horizontal.svg',
  watermarkPath: '/shared/brand/watermarks/ledger-watermark.svg',
  faviconPath: '/shared/brand/icons/favicon.svg'
};

/** Application roles used for navigation and CTA gating. */
export const ROLES = Object.freeze([
  'platform_administrator',
  'organization_owner',
  'ero',
  'office_manager',
  'tax_preparer',
  'reviewer',
  'bookkeeper',
  'payroll_specialist',
  'billing_specialist',
  'support_agent',
  'client',
  'read_only_auditor'
]);

export const ROLE_LABELS = Object.freeze({
  platform_administrator: 'Platform Administrator',
  organization_owner: 'Organization Owner',
  ero: 'ERO',
  office_manager: 'Office Manager',
  tax_preparer: 'Tax Preparer',
  reviewer: 'Reviewer',
  bookkeeper: 'Bookkeeper',
  payroll_specialist: 'Payroll Specialist',
  billing_specialist: 'Billing Specialist',
  support_agent: 'Support Agent',
  client: 'Client',
  read_only_auditor: 'Read-only Auditor'
});

/**
 * Centralized status taxonomy. Colors are semantic tokens; every status also
 * requires a text label (never color alone).
 */
export const STATUS_TAXONOMY = Object.freeze({
  general: ['active', 'inactive', 'draft', 'pending', 'complete', 'archived'],
  approval: ['not_submitted', 'submitted', 'changes_requested', 'approved', 'rejected'],
  payment: ['unpaid', 'partially_paid', 'paid', 'past_due', 'refunded', 'reversed', 'failed'],
  document: ['missing', 'requested', 'received', 'under_review', 'accepted', 'rejected', 'expired'],
  tax_return: [
    'intake',
    'in_preparation',
    'review',
    'signature_pending',
    'ready_to_file',
    'transmitted',
    'accepted',
    'rejected',
    'amended',
    'closed'
  ],
  security: ['verified', 'unverified', 'restricted', 'locked', 'suspended', 'revoked']
});

export const STATUS_META = Object.freeze({
  active: { label: 'Active', tone: 'success', group: 'general' },
  inactive: { label: 'Inactive', tone: 'neutral', group: 'general' },
  draft: { label: 'Draft', tone: 'neutral', group: 'general' },
  pending: { label: 'Pending', tone: 'warning', group: 'general' },
  complete: { label: 'Complete', tone: 'success', group: 'general' },
  archived: { label: 'Archived', tone: 'neutral', group: 'general' },
  not_submitted: { label: 'Not submitted', tone: 'neutral', group: 'approval' },
  submitted: { label: 'Submitted', tone: 'info', group: 'approval' },
  changes_requested: { label: 'Changes requested', tone: 'warning', group: 'approval' },
  approved: { label: 'Approved', tone: 'success', group: 'approval' },
  rejected: { label: 'Rejected', tone: 'danger', group: 'approval' },
  unpaid: { label: 'Unpaid', tone: 'warning', group: 'payment' },
  partially_paid: { label: 'Partially paid', tone: 'warning', group: 'payment' },
  paid: { label: 'Paid', tone: 'success', group: 'payment' },
  past_due: { label: 'Past due', tone: 'danger', group: 'payment' },
  refunded: { label: 'Refunded', tone: 'info', group: 'payment' },
  reversed: { label: 'Reversed', tone: 'danger', group: 'payment' },
  failed: { label: 'Failed', tone: 'danger', group: 'payment' },
  missing: { label: 'Missing', tone: 'danger', group: 'document' },
  requested: { label: 'Requested', tone: 'info', group: 'document' },
  received: { label: 'Received', tone: 'info', group: 'document' },
  under_review: { label: 'Under review', tone: 'warning', group: 'document' },
  accepted: { label: 'Accepted', tone: 'success', group: 'document' },
  expired: { label: 'Expired', tone: 'danger', group: 'document' },
  intake: { label: 'Intake', tone: 'info', group: 'tax_return' },
  in_preparation: { label: 'In preparation', tone: 'info', group: 'tax_return' },
  review: { label: 'Review', tone: 'warning', group: 'tax_return' },
  signature_pending: { label: 'Signature pending', tone: 'warning', group: 'tax_return' },
  ready_to_file: { label: 'Ready to file', tone: 'success', group: 'tax_return' },
  transmitted: { label: 'Transmitted', tone: 'info', group: 'tax_return' },
  amended: { label: 'Amended', tone: 'info', group: 'tax_return' },
  closed: { label: 'Closed', tone: 'neutral', group: 'tax_return' },
  verified: { label: 'Verified', tone: 'success', group: 'security' },
  unverified: { label: 'Unverified', tone: 'warning', group: 'security' },
  restricted: { label: 'Restricted', tone: 'warning', group: 'security' },
  locked: { label: 'Locked', tone: 'danger', group: 'security' },
  suspended: { label: 'Suspended', tone: 'danger', group: 'security' },
  revoked: { label: 'Revoked', tone: 'danger', group: 'security' }
});

/**
 * Enterprise navigation model. Only items with `implemented: true` should render
 * as available; others may show as limited/beta/unavailable.
 */
export const NAVIGATION = Object.freeze([
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/', service: 'modules-dashboard', implemented: true },
      { id: 'activity', label: 'Activity', href: '/#activity', service: 'modules-dashboard', implemented: true, limited: true },
      { id: 'tasks', label: 'Tasks', href: '/#tasks', service: 'modules-dashboard', implemented: true, limited: true },
      { id: 'notifications', label: 'Notifications', href: '/#notifications', service: 'modules-dashboard', implemented: true, limited: true }
    ]
  },
  {
    id: 'client_operations',
    label: 'Client Operations',
    items: [
      { id: 'clients', label: 'Clients', href: 'http://localhost:3006/#crm', service: 'pos-crm', implemented: true },
      { id: 'leads', label: 'Leads', implemented: false },
      { id: 'engagements', label: 'Engagements', implemented: false },
      { id: 'intake', label: 'Intake', href: 'http://localhost:3004/', service: 'enrollment', implemented: true, limited: true },
      { id: 'communications', label: 'Communications', implemented: false },
      { id: 'documents', label: 'Documents', href: '/#documents', service: 'modules-dashboard', implemented: true, limited: true }
    ]
  },
  {
    id: 'tax_operations',
    label: 'Tax Operations',
    items: [
      { id: 'tax_returns', label: 'Tax Returns', implemented: false },
      { id: 'efile', label: 'E-file', implemented: false },
      { id: 'acknowledgments', label: 'Acknowledgments', implemented: false },
      { id: 'notices', label: 'Notices', implemented: false },
      { id: 'transcripts', label: 'Transcripts', service: 'transcript', implemented: false, note: 'API-only (:3002)' },
      {
        id: 'refunds',
        label: 'Refunds',
        href: 'http://localhost:3001/',
        service: 'refund-status',
        implemented: true
      },
      { id: 'compliance_review', label: 'Compliance Review', implemented: false },
      { id: 'audit_defense', label: 'Audit Defense', implemented: false },
      {
        id: 'ai_workforce',
        label: 'AI Workforce',
        href: 'http://localhost:8860/',
        service: 'ai-workforce',
        implemented: true,
        limited: true
      }
    ]
  },
  {
    id: 'financial_operations',
    label: 'Financial Operations',
    items: [
      { id: 'invoices', label: 'Invoices', href: 'http://localhost:3005/', service: 'invoice', implemented: true },
      { id: 'payments', label: 'Payments', href: 'http://localhost:3005/#payments', service: 'invoice', implemented: true, limited: true },
      { id: 'service_catalog', label: 'Service Catalog', href: 'http://localhost:3005/#catalog', service: 'invoice', implemented: true },
      { id: 'pos', label: 'Point of Sale', href: 'http://localhost:3006/#pos', service: 'pos-crm', implemented: true },
      { id: 'bookkeeping', label: 'Bookkeeping', implemented: false },
      { id: 'payroll', label: 'Payroll', implemented: false },
      { id: 'reconciliation', label: 'Reconciliation', implemented: false },
      { id: 'financial_reports', label: 'Financial Reports', href: '/#reports', service: 'modules-dashboard', implemented: true, limited: true }
    ]
  },
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      { id: 'approvals', label: 'Approvals', href: 'http://localhost:3005/#approvals', service: 'invoice', implemented: true, limited: true },
      { id: 'assignments', label: 'Assignments', implemented: false },
      { id: 'cases', label: 'Cases', href: 'http://localhost:3001/', service: 'refund-status', implemented: true },
      { id: 'calendar', label: 'Calendar', implemented: false },
      { id: 'automations', label: 'Automations', implemented: false },
      { id: 'templates', label: 'Templates', implemented: false }
    ]
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { id: 'staff', label: 'Staff', href: '/#staff', service: 'modules-dashboard', implemented: true, limited: true },
      { id: 'roles', label: 'Roles and Permissions', href: 'http://127.0.0.1:8787/rbac', service: 'ross-ai', implemented: true },
      { id: 'offices', label: 'Offices', implemented: false },
      { id: 'jurisdictions', label: 'Jurisdictions', href: 'http://localhost:3005/', service: 'invoice', implemented: true, limited: true },
      { id: 'integrations', label: 'Integrations', href: 'http://localhost:8870/', service: 'apple-developer-console', implemented: true },
      { id: 'security', label: 'Security', href: 'http://127.0.0.1:8787/infrastructure', service: 'ross-ai', implemented: true, limited: true },
      { id: 'audit_logs', label: 'Audit Logs', href: 'http://localhost:3004/', service: 'enrollment', implemented: true, limited: true },
      { id: 'system_settings', label: 'System Settings', href: '/#settings', service: 'modules-dashboard', implemented: true }
    ]
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'modules', label: 'Module Catalog', href: '/#catalog', service: 'modules-dashboard', implemented: true },
      { id: 'insights', label: 'Insights', href: '/#insights', service: 'modules-dashboard', implemented: true },
      { id: 'assistant', label: 'AI Assistant', href: '/#assistant', service: 'modules-dashboard', implemented: true },
      { id: 'graph', label: 'Dependency Graph', href: '/#graph', service: 'modules-dashboard', implemented: true },
      { id: 'status', label: 'System Status', href: '/#status', service: 'modules-dashboard', implemented: true },
      { id: 'design_system', label: 'Design System', href: '/#design', service: 'modules-dashboard', implemented: true },
      { id: 'control_plane', label: 'Control Plane', href: 'http://127.0.0.1:8787/dashboard', service: 'ross-ai', implemented: true }
    ]
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { id: 'help', label: 'Help Center', href: '/#help', service: 'modules-dashboard', implemented: true, limited: true },
      { id: 'knowledge', label: 'Knowledge Base', implemented: false },
      { id: 'release_notes', label: 'Release Notes', implemented: false },
      { id: 'contact', label: 'Contact Support', href: '/#help', service: 'modules-dashboard', implemented: true, limited: true }
    ]
  }
]);

export const PAGE_LAYOUTS = Object.freeze([
  'AppShell',
  'AuthLayout',
  'DashboardLayout',
  'StandardPageLayout',
  'FormPageLayout',
  'DataWorkspaceLayout',
  'SplitViewLayout',
  'DetailPageLayout',
  'DocumentLayout',
  'SettingsLayout',
  'ClientPortalLayout',
  'FullScreenWorkflowLayout',
  'PrintLayout'
]);

export const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf'
});

/**
 * Resolve a `/shared/...` URL to a file under packages/ui-system/public.
 */
export function resolveSharedPath(urlPath) {
  const cleaned = String(urlPath || '').split('?')[0].split('#')[0];
  if (!cleaned.startsWith('/shared/')) return null;
  const relative = cleaned.slice('/shared/'.length);
  if (!relative || relative.includes('..')) return null;
  const absolute = path.join(UI_SYSTEM_PUBLIC, relative);
  if (!absolute.startsWith(UI_SYSTEM_PUBLIC)) return null;
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return null;
  return absolute;
}

/**
 * Attempt to serve a shared UI-system asset. Returns true if handled.
 */
export async function tryServeShared(response, pathname) {
  const filePath = resolveSharedPath(pathname);
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();
  const type = CONTENT_TYPES[ext] || 'application/octet-stream';
  response.writeHead(200, {
    'content-type': type,
    'cache-control': 'public, max-age=300'
  });
  createReadStream(filePath).pipe(response);
  return true;
}

export async function readSharedText(relativePath) {
  return readFile(path.join(UI_SYSTEM_PUBLIC, relativePath), 'utf8');
}

export function statusLabel(code) {
  return STATUS_META[code]?.label || String(code || 'Unknown').replace(/_/g, ' ');
}

export function statusTone(code) {
  return STATUS_META[code]?.tone || 'neutral';
}

export function navigationForRole(role = 'office_manager') {
  const clientOnly = role === 'client';
  const auditor = role === 'read_only_auditor';
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => item.implemented)
      .filter((item) => {
        if (clientOnly) {
          return ['documents', 'invoices', 'payments', 'help', 'dashboard'].includes(item.id);
        }
        if (auditor) {
          return !['ai_workforce', 'pos', 'execute'].includes(item.id);
        }
        return true;
      })
  })).filter((section) => section.items.length > 0);
}

export function descriptor() {
  return {
    name: 'ui-system',
    version: '0.1.0',
    brand: PLATFORM_BRAND,
    layouts: PAGE_LAYOUTS,
    roles: ROLES,
    statusGroups: Object.keys(STATUS_TAXONOMY),
    navigationSections: NAVIGATION.length,
    publicRoot: UI_SYSTEM_PUBLIC
  };
}
