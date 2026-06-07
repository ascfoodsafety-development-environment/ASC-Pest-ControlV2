/**
 * ASC Pest Control — RBAC + ABAC permissions
 *
 * Roles (from enums.UserRole):
 *   customer | technician | sales_agent | branch_manager | admin
 *
 * RBAC: role → allowed actions
 * ABAC: non-admin roles are branch-scoped (branch_id from JWT claim)
 *
 * This module is the single source of truth consumed by:
 *   - hub/hub.js  (dashboard routing + UI gating)
 *   - home-v2.html inline script (CTA button visibility)
 */

const ROLES = Object.freeze({
  CUSTOMER:        "customer",
  TECHNICIAN:      "technician",
  SALES_AGENT:     "sales_agent",
  BRANCH_MANAGER:  "branch_manager",
  ADMIN:           "admin",
});

/**
 * What each role can DO (actions checked before API calls and in UI).
 * The backend enforces the same rules — this is the client-side mirror.
 */
const PERMISSIONS = Object.freeze({
  // Leads
  leads_view:          [ROLES.SALES_AGENT, ROLES.BRANCH_MANAGER, ROLES.ADMIN],
  leads_create:        [ROLES.SALES_AGENT, ROLES.BRANCH_MANAGER, ROLES.ADMIN],
  leads_assign:        [ROLES.BRANCH_MANAGER, ROLES.ADMIN],

  // Quotes
  quotes_view:         [ROLES.CUSTOMER, ROLES.SALES_AGENT, ROLES.BRANCH_MANAGER, ROLES.ADMIN],
  quotes_create:       [ROLES.SALES_AGENT, ROLES.BRANCH_MANAGER, ROLES.ADMIN],
  quotes_accept:       [ROLES.CUSTOMER],

  // Bookings / Jobs
  bookings_view_own:   [ROLES.CUSTOMER, ROLES.TECHNICIAN],
  bookings_view_all:   [ROLES.BRANCH_MANAGER, ROLES.ADMIN],
  bookings_create:     [ROLES.SALES_AGENT, ROLES.BRANCH_MANAGER, ROLES.ADMIN],
  jobs_transition:     [ROLES.TECHNICIAN, ROLES.BRANCH_MANAGER, ROLES.ADMIN],

  // Invoices
  invoices_view_own:   [ROLES.CUSTOMER],
  invoices_view_all:   [ROLES.BRANCH_MANAGER, ROLES.ADMIN],
  invoices_pay:        [ROLES.CUSTOMER],

  // Scheduling
  scheduling_view:     [ROLES.TECHNICIAN, ROLES.BRANCH_MANAGER, ROLES.ADMIN],
  scheduling_manage:   [ROLES.BRANCH_MANAGER, ROLES.ADMIN],

  // Analytics
  analytics_view:      [ROLES.BRANCH_MANAGER, ROLES.ADMIN],

  // User / admin
  users_manage:        [ROLES.ADMIN],
  branch_manage:       [ROLES.ADMIN],

  // Compliance docs
  docs_view_own:       [ROLES.CUSTOMER],
  docs_view_all:       [ROLES.BRANCH_MANAGER, ROLES.ADMIN],
});

/** Which dashboard view to show after login */
const ROLE_DASHBOARD = Object.freeze({
  [ROLES.CUSTOMER]:       "client",
  [ROLES.TECHNICIAN]:     "technician",
  [ROLES.SALES_AGENT]:    "admin",   // sales agent lands on CRM/leads
  [ROLES.BRANCH_MANAGER]: "admin",
  [ROLES.ADMIN]:          "admin",
});

/** Labels shown in home-v2 nav buttons */
const ROLE_PORTAL_LABEL = Object.freeze({
  [ROLES.CUSTOMER]:       "My Portal",
  [ROLES.TECHNICIAN]:     "Field App",
  [ROLES.SALES_AGENT]:    "CRM",
  [ROLES.BRANCH_MANAGER]: "Operations",
  [ROLES.ADMIN]:          "Admin Hub",
});

function can(role, action) {
  const allowed = PERMISSIONS[action];
  return Array.isArray(allowed) && allowed.includes(role);
}

/** ABAC: return branch filter for non-admin users */
function branchScope(principal) {
  return principal.role === ROLES.ADMIN ? null : principal.branch_id;
}

if (typeof module !== "undefined") {
  module.exports = { ROLES, PERMISSIONS, ROLE_DASHBOARD, ROLE_PORTAL_LABEL, can, branchScope };
}
