import { describe, expect, it } from "vitest";
import { emptyDaySchedule } from "./scheduleMap";
import {
  dayScheduleHasEntry,
  shouldEnforceClockWindow,
  weekScheduleHasAnyEntry,
} from "./scheduleFlexibility";

describe("scheduleFlexibility", () => {
  it("treats empty week as flexible clock-in", () => {
    const schedule = {
      monday: emptyDaySchedule(false),
      tuesday: emptyDaySchedule(false),
    };
    expect(weekScheduleHasAnyEntry(schedule)).toBe(false);
    expect(shouldEnforceClockWindow(schedule, "monday", 1)).toBe(false);
  });

  it("allows flexible clock-in on days without assigned entry", () => {
    const schedule = {
      monday: { entry1: "09:00", entry2: "", exit1: "17:00", exit2: "", isActive: true },
      tuesday: emptyDaySchedule(false),
    };
    expect(shouldEnforceClockWindow(schedule, "tuesday", 1)).toBe(false);
    expect(shouldEnforceClockWindow(schedule, "monday", 1)).toBe(true);
  });

  it("ignores inactive days without entry times", () => {
    const day = emptyDaySchedule(false);
    expect(dayScheduleHasEntry(day)).toBe(false);
    expect(shouldEnforceClockWindow({ monday: day }, "monday", 1)).toBe(false);
  });

  it("enforces second slot only when entry2 exists", () => {
    const schedule = {
      monday: { entry1: "09:00", entry2: "", exit1: "14:00", exit2: "", isActive: true },
    };
    expect(shouldEnforceClockWindow(schedule, "monday", 2)).toBe(false);
  });
});
