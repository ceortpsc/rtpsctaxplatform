/** Role definitions and navigation visibility for RTPSC staff workspaces. */

export const ROLES = Object.freeze({
  platform_admin: { label: 'Platform Administrator', level: 100 },
  org_owner: { label: 'Organization Owner', level: 90 },
  ero: { label: 'ERO', level: 80 },
  office_manager: { label: 'Office Manager', level: 70 },
  tax_preparer: { label: 'Tax Preparer', level: 60 },
  reviewer: { label: 'Reviewer', level: 65 },
  bookkeeper: { label: 'Bookkeeper', level: 55 },
  payroll_specialist: { label: 'Payroll Specialist', level: 55 },
  billing_specialist: { label: 'Billing Specialist', level: 55 },
  support_agent: { label: 'Support Agent', level: 40 },
  client: { label: 'Client', level: 10 },
  auditor: { label: 'Read-only Auditor', level: 30 }
});

/** Minimum role level required for a nav item (0 = public). */
export const ROLE_LEVEL = Object.freeze(
  Object.fromEntries(Object.entries(ROLES).map(([key, { level }]) => [key, level]))
);

export function roleAtLeast(userRole, requiredRole) {
  const userLevel = ROLE_LEVEL[userRole] ?? 0;
  const requiredLevel = ROLE_LEVEL[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

export function filterNavByRole(items, userRole = 'tax_preparer') {
  return items
    .map((item) => {
      if (item.minRole && !roleAtLeast(userRole, item.minRole)) return null;
      if (item.children) {
        const children = filterNavByRole(item.children, userRole);
        if (children.length === 0 && !item.href) return null;
        return { ...item, children };
      }
      return item;
    })
    .filter(Boolean);
}
