import { EMPLOYEE_PRIVACY_NOTICE_VERSION } from "./const";

/** Company fields that affect the employee privacy notice content. */
export type PrivacyNoticeLegalSnapshot = {
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  privacyContactEmail?: string | null;
  locationEnabled?: boolean | null;
  dataRetentionYears?: number | null;
};

export function getCompanyPrivacyNoticeVersion(
  company: { employeePrivacyNoticeVersion?: string | null } | null | undefined
): string {
  const version = company?.employeePrivacyNoticeVersion?.trim();
  return version || EMPLOYEE_PRIVACY_NOTICE_VERSION;
}

/** New version string when company legal data changes (fits varchar 32). */
export function bumpPrivacyNoticeVersion(now = Date.now()): string {
  // e.g. 2026-06-22-v2-m5k2abc1  (template + base36 time)
  const stamp = now.toString(36).slice(-8);
  const base = EMPLOYEE_PRIVACY_NOTICE_VERSION.slice(0, 22);
  return `${base}-${stamp}`.slice(0, 32);
}

export function didPrivacyNoticeLegalDataChange(
  before: PrivacyNoticeLegalSnapshot,
  after: PrivacyNoticeLegalSnapshot
): boolean {
  const norm = (v: string | null | undefined) => (v ?? "").trim();
  return (
    norm(before.legalName) !== norm(after.legalName) ||
    norm(before.taxId) !== norm(after.taxId) ||
    norm(before.address) !== norm(after.address) ||
    norm(before.privacyContactEmail) !== norm(after.privacyContactEmail) ||
    Boolean(before.locationEnabled) !== Boolean(after.locationEnabled) ||
    (before.dataRetentionYears ?? 4) !== (after.dataRetentionYears ?? 4)
  );
}
