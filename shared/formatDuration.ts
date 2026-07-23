export function minutesFromMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000);
}

export function splitDurationMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const mins = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(mins / 60), minutes: mins % 60 };
}

/** Human-readable duration: "25 h 02 min" */
export function formatDurationHm(totalMinutes: number): string {
  const { hours, minutes } = splitDurationMinutes(totalMinutes);
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

export function formatDurationFromMs(ms: number): string {
  return formatDurationHm(minutesFromMs(ms));
}

function toTimestamp(value: string | Date): number {
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

export function durationMinutesBetween(startIso: string | Date, endIso: string | Date): number {
  const start = toTimestamp(startIso);
  const end = toTimestamp(endIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return minutesFromMs(end - start);
}
