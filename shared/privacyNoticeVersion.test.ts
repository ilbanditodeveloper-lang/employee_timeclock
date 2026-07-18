import { describe, expect, it } from "vitest";
import {
  bumpPrivacyNoticeVersion,
  didPrivacyNoticeLegalDataChange,
  getCompanyPrivacyNoticeVersion,
} from "./privacyNoticeVersion";
import { EMPLOYEE_PRIVACY_NOTICE_VERSION } from "./const";

describe("privacyNoticeVersion", () => {
  it("falls back to template version", () => {
    expect(getCompanyPrivacyNoticeVersion(null)).toBe(EMPLOYEE_PRIVACY_NOTICE_VERSION);
    expect(getCompanyPrivacyNoticeVersion({})).toBe(EMPLOYEE_PRIVACY_NOTICE_VERSION);
  });

  it("uses company version when set", () => {
    expect(
      getCompanyPrivacyNoticeVersion({ employeePrivacyNoticeVersion: "2026-07-18-abc" })
    ).toBe("2026-07-18-abc");
  });

  it("bumps to a new version within 32 chars", () => {
    const next = bumpPrivacyNoticeVersion(1_721_300_000_000);
    expect(next.length).toBeLessThanOrEqual(32);
    expect(next).not.toBe(EMPLOYEE_PRIVACY_NOTICE_VERSION);
  });

  it("detects material legal data changes", () => {
    expect(
      didPrivacyNoticeLegalDataChange(
        { legalName: "A", taxId: "1", address: "x", privacyContactEmail: "a@b.c", locationEnabled: false, dataRetentionYears: 4 },
        { legalName: "B", taxId: "1", address: "x", privacyContactEmail: "a@b.c", locationEnabled: false, dataRetentionYears: 4 }
      )
    ).toBe(true);

    expect(
      didPrivacyNoticeLegalDataChange(
        { legalName: "A", taxId: "1", address: "x", privacyContactEmail: "a@b.c", locationEnabled: false, dataRetentionYears: 4 },
        { legalName: "A", taxId: "1", address: "x", privacyContactEmail: "a@b.c", locationEnabled: false, dataRetentionYears: 4 }
      )
    ).toBe(false);
  });
});
