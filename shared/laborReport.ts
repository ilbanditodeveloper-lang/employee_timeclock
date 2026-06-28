/**
 * Tipos y utilidades compartidas para informes de registro horario (Fase 4).
 */

export const OFFICIAL_REPORT_DISCLAIMER =
  "Documento generado automáticamente a partir de los registros introducidos en TimeClock. " +
  "La empresa usuaria es responsable de verificar la exactitud de los datos y conservar los registros " +
  "conforme a la normativa aplicable.";

export const LEGAL_TEMPLATE_DISCLAIMER =
  "Plantilla orientativa. Requiere revisión por asesor legal/gestoría/DPO antes de uso oficial.";

export type TimeclockStatus = "valid" | "corrected" | "voided";

export type LaborReportCompanyHeader = {
  id: number;
  name: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  privacyContactEmail: string | null;
  timezone: string;
  dataRetentionYears: number;
};

export type LaborReportWorkplace = {
  id: number;
  name: string;
  address: string | null;
};

export type LaborReportEmployeeInfo = {
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  workplaceName: string;
};

export type LaborReportDayRow = {
  timeclockId: number;
  employeeId: number;
  employeeName: string;
  employeeUsername: string;
  workplaceName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: null;
  breakEnd: null;
  breakLabel: string;
  totalMinutes: number | null;
  totalHours: number | null;
  status: string;
  statusCode: TimeclockStatus | "incomplete";
  isLate: boolean;
  modified: boolean;
  modifiedBy: string | null;
  modificationReason: string | null;
  notes: string | null;
};

export type LaborReportAuditEntry = {
  id: number;
  performedAt: string;
  action: string;
  entityType: string;
  entityId: number;
  employeeId: number | null;
  employeeName: string | null;
  performedByName: string | null;
  reason: string | null;
  summary: string;
};

export type LaborReportSummary = {
  totalHours: number;
  daysWithClock: number;
  incompleteDays: number;
  correctedCount: number;
  voidedCount: number;
  incidentCount: number;
};

export type LaborReportBundle = {
  company: LaborReportCompanyHeader;
  workplace: LaborReportWorkplace;
  period: { from: string; to: string };
  generatedAt: string;
  employeeFilter: string;
  rows: LaborReportDayRow[];
  summary: LaborReportSummary;
  auditHistory: LaborReportAuditEntry[];
};

export const CSV_HEADERS = [
  "company_id",
  "company_name",
  "employee_id",
  "employee_name",
  "employee_username",
  "workplace_name",
  "date",
  "clock_in",
  "clock_out",
  "break_start",
  "break_end",
  "total_minutes",
  "total_hours",
  "status",
  "is_late",
  "modified",
  "modified_by",
  "modification_reason",
  "notes",
] as const;

export function formatIsoInTimezone(iso: string | Date | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("es-ES", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
}

export function formatDateInTimezone(iso: string | Date | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString("es-ES", { timeZone: tz });
  } catch {
    return d.toLocaleDateString("es-ES");
  }
}

export function toYmdFromDate(d: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch {
    /* fallback */
  }
  return d.toISOString().slice(0, 10);
}

export function computeMinutes(entryTime: Date | null, exitTime: Date | null): number | null {
  if (!entryTime || !exitTime) return null;
  const ms = exitTime.getTime() - entryTime.getTime();
  if (ms <= 0) return null;
  return Math.round(ms / 60000);
}

export function computeHoursFromMinutes(minutes: number | null): number | null {
  if (minutes === null) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

export function rowStatusLabel(
  status: TimeclockStatus,
  hasExit: boolean
): { code: TimeclockStatus | "incomplete"; label: string } {
  if (status === "voided") return { code: "voided", label: "Anulado" };
  if (status === "corrected") {
    return hasExit
      ? { code: "corrected", label: "Corregido" }
      : { code: "incomplete", label: "Incompleto (corregido)" };
  }
  if (!hasExit) return { code: "incomplete", label: "Incompleto" };
  return { code: "valid", label: "Completo" };
}

export function buildLaborReportSummary(rows: LaborReportDayRow[], incidentCount: number): LaborReportSummary {
  const nonVoided = rows.filter((r) => r.statusCode !== "voided");
  const totalHours = nonVoided.reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
  const datesWithClock = new Set(nonVoided.filter((r) => r.clockIn).map((r) => r.date));
  return {
    totalHours: Math.round(totalHours * 100) / 100,
    daysWithClock: datesWithClock.size,
    incompleteDays: rows.filter((r) => r.statusCode === "incomplete").length,
    correctedCount: rows.filter((r) => r.statusCode === "corrected").length,
    voidedCount: rows.filter((r) => r.statusCode === "voided").length,
    incidentCount,
  };
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function laborReportRowsToCsv(rows: LaborReportDayRow[], company: LaborReportCompanyHeader): string {
  const lines = [CSV_HEADERS.join(";")];
  for (const r of rows) {
    lines.push(
      [
        company.id,
        company.name,
        r.employeeId,
        r.employeeName,
        r.employeeUsername,
        r.workplaceName,
        r.date,
        r.clockIn ?? "",
        r.clockOut ?? "",
        "",
        "",
        r.totalMinutes ?? "",
        r.totalHours ?? "",
        r.status,
        r.isLate ? "true" : "false",
        r.modified ? "true" : "false",
        r.modifiedBy ?? "",
        r.modificationReason ?? "",
        r.notes ?? "",
      ]
        .map(csvEscape)
        .join(";")
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function summarizeAuditChange(
  action: string,
  oldValue: unknown,
  newValue: unknown
): string {
  if (action === "void" || action === "void_bulk") return "Fichaje anulado";
  if (action === "correct") {
    const oldV = oldValue as { entryTime?: string; exitTime?: string } | null;
    const newV = newValue as { entryTime?: string; exitTime?: string } | null;
    return `Entrada/salida: ${oldV?.entryTime ?? "?"} → ${newV?.entryTime ?? "?"} / ${oldV?.exitTime ?? "?"} → ${newV?.exitTime ?? "?"}`;
  }
  if (action === "deactivate") return "Empleado desactivado";
  if (action === "update_legal") return "Datos legales actualizados";
  if (action === "complete_onboarding") return "Onboarding completado";
  return action;
}

export function calendarMonthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}
