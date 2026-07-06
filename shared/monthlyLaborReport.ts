import type { LaborReportDayRow } from "./laborReport";
import type { LaborReportEmployeeInfo } from "./laborReport";

export type ContractType = "full_time" | "part_time" | "temporary" | "other";

export type MonthlyEmployeeSummary = {
  employee: LaborReportEmployeeInfo & {
    nationalId: string | null;
    contractType: ContractType;
    weeklyContractedHours: number | null;
    monthlyContractedHours: number | null;
  };
  period: { year: number; month: number; from: string; to: string };
  daysWorked: number;
  dailyRows: LaborReportDayRow[];
  totalGrossHours: number;
  totalNetHours: number;
  totalBreakMinutes: number;
  contractedMonthlyHours: number | null;
  hoursDifference: number | null;
  extraHoursEstimate: number | null;
  correctionCount: number;
  incidentCount: number;
  generatedAt: string;
};

export function computeMonthlyContractedHours(weeklyHours: number | null): number | null {
  if (weeklyHours == null || Number.isNaN(weeklyHours)) return null;
  return Math.round(weeklyHours * (52 / 12) * 100) / 100;
}

export function monthlyReportToCsv(summary: MonthlyEmployeeSummary): string {
  const lines: string[] = [];
  const e = summary.employee;
  lines.push("Resumen mensual trabajador");
  lines.push(`Trabajador;${e.name}`);
  lines.push(`DNI/NIE;${e.nationalId ?? ""}`);
  lines.push(`Tipo contrato;${e.contractType}`);
  lines.push(`Horas semanales contratadas;${e.weeklyContractedHours ?? ""}`);
  lines.push(`Periodo;${summary.period.from} → ${summary.period.to}`);
  lines.push(`Días trabajados;${summary.daysWorked}`);
  lines.push(`Total horas brutas;${summary.totalGrossHours}`);
  lines.push(`Total pausas (min);${summary.totalBreakMinutes}`);
  lines.push(`Total horas netas;${summary.totalNetHours}`);
  lines.push(`Horas contratadas mes;${summary.contractedMonthlyHours ?? ""}`);
  lines.push(`Diferencia;${summary.hoursDifference ?? ""}`);
  lines.push(`Incidencias;${summary.incidentCount}`);
  lines.push(`Correcciones;${summary.correctionCount}`);
  lines.push(`Generado;${summary.generatedAt}`);
  lines.push("");
  lines.push(
    "Fecha;Entrada;Salida;Pausas;H. brutas;H. netas;Estado;Motivo corrección;Corregido por;Corregido el"
  );
  for (const r of summary.dailyRows) {
    lines.push(
      [
        r.date,
        r.clockIn ?? "",
        r.clockOut ?? "",
        r.breakLabel,
        r.grossHours ?? "",
        r.totalHours ?? "",
        r.status,
        r.modificationReason ?? "",
        r.modifiedBy ?? "",
        r.correctedAt ?? "",
      ].join(";")
    );
  }
  return lines.join("\n");
}

export function buildMonthlyEmployeeSummary(input: {
  employee: {
    id: number;
    name: string;
    username: string;
    isActive: boolean;
    workplaceName: string;
    nationalId?: string | null;
    contractType?: ContractType | null;
    weeklyContractedHours?: number | null;
  };
  year: number;
  month: number;
  rows: LaborReportDayRow[];
  incidentCount: number;
  generatedAt?: string;
}): MonthlyEmployeeSummary {
  const nonVoided = input.rows.filter((r) => r.statusCode !== "voided");
  const dates = new Set(nonVoided.filter((r) => r.clockIn).map((r) => r.date));
  const totalGrossHours = Math.round(nonVoided.reduce((s, r) => s + (r.grossHours ?? 0), 0) * 100) / 100;
  const totalNetHours = Math.round(nonVoided.reduce((s, r) => s + (r.totalHours ?? 0), 0) * 100) / 100;
  const totalBreakMinutes = nonVoided.reduce((s, r) => s + r.breakMinutes, 0);
  const weekly = input.employee.weeklyContractedHours ?? null;
  const contractedMonthlyHours = computeMonthlyContractedHours(weekly);
  const hoursDifference =
    contractedMonthlyHours != null ? Math.round((totalNetHours - contractedMonthlyHours) * 100) / 100 : null;
  const extraHoursEstimate =
    hoursDifference != null && hoursDifference > 0 ? hoursDifference : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(input.year, input.month, 0).getDate();

  return {
    employee: {
      id: input.employee.id,
      name: input.employee.name,
      username: input.employee.username,
      isActive: input.employee.isActive,
      workplaceName: input.employee.workplaceName,
      nationalId: input.employee.nationalId ?? null,
      contractType: input.employee.contractType ?? "full_time",
      weeklyContractedHours: weekly,
      monthlyContractedHours: contractedMonthlyHours,
    },
    period: {
      year: input.year,
      month: input.month,
      from: `${input.year}-${pad(input.month)}-01`,
      to: `${input.year}-${pad(input.month)}-${pad(lastDay)}`,
    },
    daysWorked: dates.size,
    dailyRows: input.rows,
    totalGrossHours,
    totalNetHours,
    totalBreakMinutes,
    contractedMonthlyHours,
    hoursDifference,
    extraHoursEstimate,
    correctionCount: input.rows.filter((r) => r.statusCode === "corrected").length,
    incidentCount: input.incidentCount,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
