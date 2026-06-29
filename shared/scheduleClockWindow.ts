/** Ventana de fichaje respecto a la hora programada (minutos desde medianoche). */
export function getClockWindowMinutes(
  scheduleHour: number,
  scheduleMinute: number,
  graceMinutes: number,
  earlyMinutes: number
) {
  const start = scheduleHour * 60 + scheduleMinute;
  return {
    earliest: start - earlyMinutes,
    latest: start + graceMinutes,
  };
}

export function parseScheduleEntryTime(entryTime: string): { hour: number; minute: number } | null {
  const normalized = entryTime.replace(".", ":").trim();
  if (!normalized || normalized === "00:00") return null;
  if (normalized.includes(":")) {
    const [hourStr, minuteStr] = normalized.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr || "0");
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { hour, minute };
  }
  const hour = Number(normalized);
  if (Number.isNaN(hour)) return null;
  return { hour, minute: 0 };
}

export function formatScheduleTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
