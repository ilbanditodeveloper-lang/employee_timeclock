import { describe, expect, it } from "vitest";
import {
  isWithinMinimumRetention,
  MINIMUM_RETENTION_YEARS,
  normalizeRetentionPolicy,
  RETENTION_BLOCK_DELETE_MSG,
} from "./retentionPolicy";

describe("retentionPolicy", () => {
  it("bloquea borrado antes de 4 años", () => {
    const policy = normalizeRetentionPolicy({ dataRetentionYears: 4 });
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 1);
    expect(isWithinMinimumRetention(recent, policy)).toBe(true);
    expect(MINIMUM_RETENTION_YEARS).toBe(4);
    expect(RETENTION_BLOCK_DELETE_MSG).toContain("4 años");
  });

  it("permite purga tras plazo configurado sin legal hold", () => {
    const policy = normalizeRetentionPolicy({ dataRetentionYears: 4, legalHoldEnabled: false });
    const old = new Date("2018-01-01");
    expect(isWithinMinimumRetention(old, policy, new Date("2026-01-01"))).toBe(false);
  });
});
