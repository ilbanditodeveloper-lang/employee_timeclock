import {
  type DaySchedulePayload,
  SCHEDULE_DAY_KEYS,
  type ScheduleDayKey,
} from "./scheduleMap";
import { parseScheduleEntryTime } from "./scheduleClockWindow";

export function dayScheduleHasEntry(day: DaySchedulePayload | undefined): boolean {
  if (!day?.isActive) return false;
  return Boolean(
    parseScheduleEntryTime(day.entry1) || parseScheduleEntryTime(day.entry2)
  );
}

export function weekScheduleHasAnyEntry(
  scheduleMap: Record<string, DaySchedulePayload | undefined>
): boolean {
  return SCHEDULE_DAY_KEYS.some((key) => dayScheduleHasEntry(scheduleMap[key]));
}

export function getEffectiveEntryTimeForSlot(
  day: DaySchedulePayload | undefined,
  slot: 1 | 2
): string | null {
  if (!day?.isActive) return null;
  const raw = slot === 2 ? day.entry2 : day.entry1;
  return parseScheduleEntryTime(raw ?? "") ? raw : null;
}

/** Si false, el empleado puede fichar a cualquier hora (sin cuadrante o sin turno ese día). */
export function shouldEnforceClockWindow(
  scheduleMap: Record<string, DaySchedulePayload | undefined>,
  dayKey: ScheduleDayKey,
  slot: 1 | 2
): boolean {
  if (!weekScheduleHasAnyEntry(scheduleMap)) return false;
  return getEffectiveEntryTimeForSlot(scheduleMap[dayKey], slot) !== null;
}

export function resolveClockEntrySlot(params: {
  completedShiftsToday: number;
}): 1 | 2 | null {
  if (params.completedShiftsToday === 0) return 1;
  if (params.completedShiftsToday === 1) return 2;
  return null;
}
