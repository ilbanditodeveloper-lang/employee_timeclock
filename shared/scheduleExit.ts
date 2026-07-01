import { formatScheduleTime, parseScheduleEntryTime } from "./scheduleClockWindow";

/** Duración por defecto del turno cuando no hay hora de salida explícita. */
export const DEFAULT_SHIFT_MINUTES = 8 * 60;

export function minutesToScheduleTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return formatScheduleTime(Math.floor(normalized / 60), normalized % 60);
}

export function scheduleTimeToMinutes(time: string): number | null {
  const parsed = parseScheduleEntryTime(time);
  if (!parsed) return null;
  return parsed.hour * 60 + parsed.minute;
}

/**
 * Hora de salida efectiva para recordatorios push.
 * - Usa exitTime de BD si existe.
 * - Turno partido: la salida del primer tramo coincide con la entrada del segundo.
 * - Turno simple: entrada + DEFAULT_SHIFT_MINUTES.
 */
export function resolveScheduleExitTime(params: {
  entryTime: string;
  exitTime?: string | null;
  nextEntryTime?: string | null;
  defaultShiftMinutes?: number;
}): string | null {
  const explicit = params.exitTime?.trim();
  if (explicit && explicit !== "00:00") return explicit;

  const nextEntry = params.nextEntryTime?.trim();
  if (nextEntry && nextEntry !== "00:00") return nextEntry;

  const entryMinutes = scheduleTimeToMinutes(params.entryTime);
  if (entryMinutes == null) return null;

  const shift = params.defaultShiftMinutes ?? DEFAULT_SHIFT_MINUTES;
  return minutesToScheduleTime(entryMinutes + shift);
}

export function buildReminderMinuteSlots(scheduleMinutes: number, leadMinutes: number): number[] {
  const slots = new Set<number>();
  slots.add(scheduleMinutes);
  if (leadMinutes > 0) slots.add(scheduleMinutes - leadMinutes);
  return Array.from(slots).map((minute) => ((minute % 1440) + 1440) % 1440);
}
