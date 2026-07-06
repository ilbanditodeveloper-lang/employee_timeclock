import { describe, expect, it } from "vitest";
import { buildMonthlyEmployeeSummary, computeMonthlyContractedHours } from "./monthlyLaborReport";
import { NO_BREAKS_LABEL } from "./laborBreaks";
import type { LaborReportDayRow } from "./laborReport";

const baseRow = (overrides: Partial<LaborReportDayRow>): LaborReportDayRow => ({
  timeclockId: 1,
  employeeId: 1,
  employeeName: "Ana",
  employeeUsername: "ana",
  workplaceName: "Centro",
  date: "2026-07-01",
  clockIn: "09:00",
  clockOut: "17:00",
  breaks: [],
  breakStart: null,
  breakEnd: null,
  breakLabel: NO_BREAKS_LABEL,
  grossMinutes: 480,
  grossHours: 8,
  breakMinutes: 0,
  breakHours: 0,
  totalMinutes: 480,
  totalHours: 8,
  status: "Completo",
  statusCode: "valid",
  isLate: false,
  modified: false,
  modifiedBy: null,
  modificationReason: null,
  correctedAt: null,
  hasOpenBreak: false,
  notes: null,
  ...overrides,
});

describe("monthlyLaborReport", () => {
  it("calcula horas mensuales contratadas desde 20h semanales", () => {
    expect(computeMonthlyContractedHours(20)).toBeCloseTo(86.67, 1);
  });

  it("resume mes con pausas descontadas y diferencia contractual", () => {
    const summary = buildMonthlyEmployeeSummary({
      employee: {
        id: 1,
        name: "Ana",
        username: "ana",
        isActive: true,
        workplaceName: "Centro",
        contractType: "part_time",
        weeklyContractedHours: 20,
      },
      year: 2026,
      month: 7,
      rows: [
        baseRow({ date: "2026-07-01", grossHours: 9, totalHours: 8, breakMinutes: 60 }),
        baseRow({ timeclockId: 2, date: "2026-07-02", grossHours: 4, totalHours: 4, breakMinutes: 0 }),
      ],
      incidentCount: 0,
    });
    expect(summary.daysWorked).toBe(2);
    expect(summary.totalGrossHours).toBe(13);
    expect(summary.totalNetHours).toBe(12);
    expect(summary.totalBreakMinutes).toBe(60);
    expect(summary.employee.contractType).toBe("part_time");
    expect(summary.hoursDifference).not.toBeNull();
  });
});
