/**
 * Roles y permisos admin para SaaS B2B multiempresa.
 */

export type AdminRole =
  | "owner"
  | "admin"
  | "hr_manager"
  | "accountant"
  | "read_only_auditor";

export type AdminPermission =
  | "manage_billing"
  | "accept_dpa"
  | "update_company_legal"
  | "enable_gps"
  | "manage_employees"
  | "correct_timeclocks"
  | "export_reports"
  | "export_inspection_zip"
  | "view_audit"
  | "manage_gdpr_requests"
  | "manage_schedules";

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  owner: [
    "manage_billing",
    "accept_dpa",
    "update_company_legal",
    "enable_gps",
    "manage_employees",
    "correct_timeclocks",
    "export_reports",
    "export_inspection_zip",
    "view_audit",
    "manage_gdpr_requests",
    "manage_schedules",
  ],
  admin: [
    "update_company_legal",
    "enable_gps",
    "manage_employees",
    "correct_timeclocks",
    "export_reports",
    "export_inspection_zip",
    "view_audit",
    "manage_gdpr_requests",
    "manage_schedules",
  ],
  hr_manager: [
    "manage_employees",
    "correct_timeclocks",
    "export_reports",
    "view_audit",
    "manage_gdpr_requests",
    "manage_schedules",
  ],
  accountant: ["export_reports", "view_audit"],
  read_only_auditor: ["view_audit", "export_reports"],
};

export function resolveAdminRole(role: string | null | undefined): AdminRole {
  if (role && role in ROLE_PERMISSIONS) return role as AdminRole;
  return "admin";
}

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertAdminPermission(role: AdminRole, permission: AdminPermission): void {
  if (!hasAdminPermission(role, permission)) {
    throw new Error("No tiene permisos para esta acción.");
  }
}
