import { describe, expect, it } from "vitest";
import {
  buildReminderMinuteSlots,
  minutesToScheduleTime,
  resolveScheduleExitTime,
} from "./scheduleExit";

describe("resolveScheduleExitTime", () => {
  it("uses explicit exit time when set", () => {
    expect(
      resolveScheduleExitTime({ entryTime: "09:00", exitTime: "17:30" })
    ).toBe("17:30");
  });

  it("uses next entry for split shift first slot", () => {
    expect(
      resolveScheduleExitTime({
        entryTime: "09:00",
        nextEntryTime: "16:00",
      })
    ).toBe("16:00");
  });

  it("defaults to entry plus eight hours", () => {
    expect(resolveScheduleExitTime({ entryTime: "09:00" })).toBe("17:00");
  });
});

describe("buildReminderMinuteSlots", () => {
  it("includes on-time and lead slots", () => {
    expect(buildReminderMinuteSlots(9 * 60, 5)).toEqual([9 * 60, 9 * 60 - 5]);
  });
});

describe("minutesToScheduleTime", () => {
  it("wraps past midnight", () => {
    expect(minutesToScheduleTime(24 * 60)).toBe("00:00");
  });
});
