import type { DaySchedule } from "./scheduleDefaults";

export type ScheduleDayMode = "continuous" | "split";

export function getScheduleDayMode(day: DaySchedule): ScheduleDayMode {
  return day.entry2.trim() ? "split" : "continuous";
}

export function inactiveDaySchedule(): DaySchedule {
  return { entry1: "", entry2: "", exit1: "", exit2: "", isActive: false };
}

export function setScheduleDayMode(day: DaySchedule, mode: ScheduleDayMode): DaySchedule {
  if (mode === "continuous") {
    return { ...day, entry2: "", exit2: "" };
  }
  return day;
}

export function setScheduleDayActive(day: DaySchedule, isActive: boolean): DaySchedule {
  if (!isActive) return inactiveDaySchedule();
  return { ...day, isActive: true };
}

type TimeField = "entry1" | "entry2" | "exit1" | "exit2";

export function setScheduleDayTime(day: DaySchedule, field: TimeField, value: string): DaySchedule {
  if (field === "entry1") {
    return { ...day, entry1: value, exit1: "" };
  }
  if (field === "entry2") {
    return { ...day, entry2: value, exit2: "" };
  }
  return { ...day, [field]: value };
}
