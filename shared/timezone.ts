/** Zona horaria oficial de la app (España peninsular). */
export const APP_TIMEZONE = "Europe/Madrid";

export type TimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getTimePartsInTimeZone(date: Date, timeZone = APP_TIMEZONE): TimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    year: Number(lookup("year")),
    month: Number(lookup("month")),
    day: Number(lookup("day")),
    hour: Number(lookup("hour")),
    minute: Number(lookup("minute")),
  };
}

/** Fecha calendario YYYY-MM-DD en la zona indicada. */
export function todayYmdInTimeZone(timeZone = APP_TIMEZONE, date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/** 0 = domingo … 6 = sábado (igual que Date.getDay). */
export function getDayOfWeekInTimeZone(date: Date, timeZone = APP_TIMEZONE): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? date.getDay();
}

export function getMinutesSinceMidnightInTimeZone(date: Date, timeZone = APP_TIMEZONE): number {
  const { hour, minute } = getTimePartsInTimeZone(date, timeZone);
  return hour * 60 + minute;
}

export function formatTimeInTimeZone(
  date: Date,
  timeZone = APP_TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleTimeString("es-ES", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: options?.second ? "2-digit" : undefined,
    ...options,
  });
}

export function formatDateInTimeZone(
  date: Date,
  timeZone = APP_TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleDateString("es-ES", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  });
}

export function resolveAppTimeZone(companyTimezone?: string | null): string {
  const tz = companyTimezone?.trim();
  return tz || APP_TIMEZONE;
}
