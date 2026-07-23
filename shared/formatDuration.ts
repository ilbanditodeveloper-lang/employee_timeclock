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

export function durationMinutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return minutesFromMs(end - start);
}
