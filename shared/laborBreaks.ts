/**
 * Cálculo de pausas y horas netas para informes de registro horario.
 */

export type BreakSegmentInput = {
  id: number;
  startedAt: Date | string;
  endedAt: Date | string | null;
};

export type ComputedBreakSegment = {
  id: number;
  start: Date;
  end: Date | null;
  durationMinutes: number | null;
  isOpen: boolean;
};

export const NO_BREAKS_LABEL = "Sin pausas registradas";
export const OPEN_BREAK_INCIDENT = "Pausa abierta o inconsistente";

export function parseBreakDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function computeBreakSegments(
  breaks: BreakSegmentInput[],
  asOf: Date = new Date()
): ComputedBreakSegment[] {
  return breaks.map((b) => {
    const start = parseBreakDate(b.startedAt);
    const end = b.endedAt ? parseBreakDate(b.endedAt) : null;
    const isOpen = !end;
    let durationMinutes: number | null = null;
    if (end) {
      const ms = end.getTime() - start.getTime();
      durationMinutes = ms > 0 ? Math.round(ms / 60000) : 0;
    } else if (asOf.getTime() > start.getTime()) {
      durationMinutes = Math.round((asOf.getTime() - start.getTime()) / 60000);
    }
    return { id: b.id, start, end, durationMinutes, isOpen };
  });
}

export function sumBreakMinutes(segments: ComputedBreakSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
}

export function hasOpenOrInvalidBreaks(segments: ComputedBreakSegment[]): boolean {
  return segments.some((s) => s.isOpen || (s.durationMinutes !== null && s.durationMinutes <= 0));
}

export function formatBreakTime(d: Date, tz: string): string {
  try {
    return d.toLocaleString("es-ES", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
}

export function formatBreakLabel(segments: ComputedBreakSegment[], tz: string): string {
  if (segments.length === 0) return NO_BREAKS_LABEL;
  return segments
    .map((s) => {
      const start = formatBreakTime(s.start, tz);
      if (s.isOpen) return `${start}–(abierta)`;
      const end = s.end ? formatBreakTime(s.end, tz) : "?";
      const mins = s.durationMinutes ?? 0;
      return `${start}–${end} (${mins} min)`;
    })
    .join("; ");
}

export function computeGrossAndNetMinutes(
  entryTime: Date | null,
  exitTime: Date | null,
  breakMinutes: number
): { grossMinutes: number | null; netMinutes: number | null } {
  if (!entryTime || !exitTime) return { grossMinutes: null, netMinutes: null };
  const ms = exitTime.getTime() - entryTime.getTime();
  if (ms <= 0) return { grossMinutes: null, netMinutes: null };
  const grossMinutes = Math.round(ms / 60000);
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  return { grossMinutes, netMinutes };
}

export function roundHours(minutes: number | null): number | null {
  if (minutes === null) return null;
  return Math.round((minutes / 60) * 100) / 100;
}
