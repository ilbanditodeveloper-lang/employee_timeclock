import { describe, expect, it } from "vitest";
import {
  computeBreakSegments,
  computeGrossAndNetMinutes,
  formatBreakLabel,
  NO_BREAKS_LABEL,
  OPEN_BREAK_INCIDENT,
  sumBreakMinutes,
} from "./laborBreaks";
import { buildLaborReportSummary, laborReportRowsToCsv } from "./laborReport";
import type { LaborReportDayRow } from "./laborReport";

describe("laborBreaks", () => {
  it("calcula 9h brutas y 8h netas con pausa 16:00–17:00 en jornada 13:00–22:00", () => {
    const entry = new Date("2026-07-06T13:00:00+02:00");
    const exit = new Date("2026-07-06T22:00:00+02:00");
    const segments = computeBreakSegments([
      {
        id: 1,
        startedAt: new Date("2026-07-06T16:00:00+02:00"),
        endedAt: new Date("2026-07-06T17:00:00+02:00"),
      },
    ]);
    const breakMinutes = sumBreakMinutes(segments);
    expect(breakMinutes).toBe(60);
    const { grossMinutes, netMinutes } = computeGrossAndNetMinutes(entry, exit, breakMinutes);
    expect(grossMinutes).toBe(540);
    expect(netMinutes).toBe(480);
    expect((grossMinutes ?? 0) / 60).toBe(9);
    expect((netMinutes ?? 0) / 60).toBe(8);
  });

  it('indica "Sin pausas registradas" cuando no hay pausas', () => {
    expect(formatBreakLabel([], "Europe/Madrid")).toBe(NO_BREAKS_LABEL);
  });

  it("formatea pausas con inicio, fin y duración", () => {
    const label = formatBreakLabel(
      computeBreakSegments([
        {
          id: 1,
          startedAt: new Date("2026-07-06T16:00:00+02:00"),
          endedAt: new Date("2026-07-06T17:00:00+02:00"),
        },
      ]),
      "Europe/Madrid"
    );
    expect(label).toContain("60 min");
    expect(label).not.toBe(NO_BREAKS_LABEL);
  });

  it("marca pausa abierta como incidencia", () => {
    const segments = computeBreakSegments([
      { id: 1, startedAt: new Date("2026-07-06T16:00:00+02:00"), endedAt: null },
    ]);
    expect(segments[0].isOpen).toBe(true);
    expect(formatBreakLabel(segments, "Europe/Madrid")).toContain("(abierta)");
  });
});

describe("laborReport CSV", () => {
  const company = {
    id: 1,
    name: "Test Co",
    legalName: "Test SL",
    taxId: "B12345678",
    address: "Calle 1",
    privacyContactEmail: "priv@test.es",
    timezone: "Europe/Madrid",
    dataRetentionYears: 4,
  };

  const baseRow: LaborReportDayRow = {
    timeclockId: 1,
    employeeId: 1,
    employeeName: "Ana",
    employeeUsername: "ana",
    workplaceName: "Centro",
    date: "2026-07-06",
    clockIn: "13:00",
    clockOut: "22:00",
    breaks: [],
    breakStart: null,
    breakEnd: null,
    breakLabel: NO_BREAKS_LABEL,
    grossMinutes: 540,
    grossHours: 9,
    breakMinutes: 60,
    breakHours: 1,
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
  };

  it("incluye horas brutas, netas y pausas en CSV", () => {
    const row: LaborReportDayRow = {
      ...baseRow,
      breaks: [
        {
          id: 1,
          startLabel: "16:00",
          endLabel: "17:00",
          durationMinutes: 60,
          isOpen: false,
        },
      ],
      breakLabel: "16:00–17:00 (60 min)",
      breakMinutes: 60,
      totalHours: 8,
      grossHours: 9,
    };
    const csv = laborReportRowsToCsv([row], company);
    expect(csv).toContain("gross_hours");
    expect(csv).toContain("net_hours");
    expect(csv).toContain("break_minutes");
    expect(csv).toContain("9");
    expect(csv).toContain("8");
    expect(csv).toContain("60");
  });

  it("resume horas netas en summary", () => {
    const summary = buildLaborReportSummary(
      [
        baseRow,
        { ...baseRow, timeclockId: 2, totalHours: 4, totalMinutes: 240, statusCode: "voided" },
      ],
      0
    );
    expect(summary.totalGrossHours).toBe(9);
    expect(summary.totalHours).toBe(8);
    expect(summary.totalBreakMinutes).toBe(60);
  });

  it("registra incidencia por pausa abierta en notas", () => {
    const row: LaborReportDayRow = {
      ...baseRow,
      hasOpenBreak: true,
      notes: OPEN_BREAK_INCIDENT,
    };
    const csv = laborReportRowsToCsv([row], company);
    expect(csv).toContain(OPEN_BREAK_INCIDENT);
  });
});
