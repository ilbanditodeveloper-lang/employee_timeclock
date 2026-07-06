import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { LaborReportBundle } from "@shared/laborReport";
import { OFFICIAL_REPORT_DISCLAIMER, laborReportRowsToCsv } from "@shared/laborReport";
import type { MonthlyEmployeeSummary } from "@shared/monthlyLaborReport";
import { monthlyReportToCsv } from "@shared/monthlyLaborReport";
import { OFFICIAL_EXPORT_FOOTER } from "@shared/legalCompliance";

function companyHeaderLines(bundle: LaborReportBundle): string[] {
  const c = bundle.company;
  return [
    c.name,
    c.legalName ? `Razón social: ${c.legalName}` : "",
    c.taxId ? `CIF/NIF: ${c.taxId}` : "",
    c.address ? `Dirección: ${c.address}` : "",
    c.privacyContactEmail ? `Contacto privacidad: ${c.privacyContactEmail}` : "",
    `Periodo: ${bundle.period.from} → ${bundle.period.to}`,
    `Zona horaria: ${c.timezone}`,
    `Generado: ${new Date(bundle.generatedAt).toLocaleString("es-ES", { timeZone: c.timezone })}`,
  ].filter(Boolean);
}

export function downloadLaborReportCsv(bundle: LaborReportBundle) {
  const csv = laborReportRowsToCsv(bundle.rows, bundle.company);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registro_horario_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadOfficialLaborReportPdf(bundle: LaborReportBundle) {
  const doc = new jsPDF({ orientation: "portrait" });
  let y = 14;

  doc.setFontSize(14);
  doc.text("Informe registro horario", 14, y);
  y += 8;
  doc.setFontSize(9);
  for (const line of companyHeaderLines(bundle)) {
    doc.text(line, 14, y);
    y += 5;
  }
  y += 2;
  doc.text(`Empleado(s): ${bundle.employeeFilter}`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Fecha",
        "Empleado",
        "Entrada",
        "Salida",
        "Pausas",
        "H. brutas",
        "H. netas",
        "Estado",
        "Retraso",
        "Modificado",
        "Motivo",
        "Corregido el",
      ],
    ],
    body:
      bundle.rows.length > 0
        ? bundle.rows.map((r) => [
            r.date,
            r.employeeName,
            r.clockIn ?? "—",
            r.clockOut ?? "—",
            r.breakLabel,
            r.grossHours != null ? r.grossHours.toFixed(2) : "—",
            r.totalHours != null ? r.totalHours.toFixed(2) : "—",
            r.status,
            r.isLate ? "Sí" : "No",
            r.modified ? (r.modifiedBy ?? "Sí") : "No",
            r.modificationReason ?? "",
            r.correctedAt
              ? new Date(r.correctedAt).toLocaleString("es-ES", { timeZone: bundle.company.timezone })
              : "",
          ])
        : [["Sin registros en el periodo", "", "", "", "", "", "", "", "", "", "", ""]],
    styles: { fontSize: 7 },
    headStyles: { fillColor: [60, 60, 60] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;

  doc.setFontSize(9);
  doc.text("Resumen", 14, finalY + 10);
  doc.setFontSize(8);
  doc.text(`Total horas netas (sin anulados): ${bundle.summary.totalHours.toFixed(2)} h`, 14, finalY + 16);
  doc.text(`Total horas brutas: ${bundle.summary.totalGrossHours.toFixed(2)} h · Pausas: ${bundle.summary.totalBreakMinutes} min`, 14, finalY + 21);
  doc.text(`Días con fichaje: ${bundle.summary.daysWithClock}`, 14, finalY + 26);
  doc.text(`Incompletos: ${bundle.summary.incompleteDays} · Corregidos: ${bundle.summary.correctedCount} · Anulados: ${bundle.summary.voidedCount}`, 14, finalY + 31);
  doc.text(`Incidencias en periodo: ${bundle.summary.incidentCount} · Pausas abiertas: ${bundle.summary.openBreakCount}`, 14, finalY + 36);

  if (bundle.auditHistory.length > 0) {
    doc.addPage();
    doc.setFontSize(11);
    doc.text("Historial de cambios", 14, 14);
    autoTable(doc, {
      startY: 18,
      head: [["Fecha", "Acción", "Empleado", "Usuario", "Resumen", "Motivo"]],
      body: bundle.auditHistory.map((a) => [
        new Date(a.performedAt).toLocaleString("es-ES"),
        a.action,
        a.employeeName ?? "—",
        a.performedByName ?? "—",
        a.summary,
        a.reason ?? "",
      ]),
      styles: { fontSize: 7 },
    });
  }

  const disclaimerY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? finalY + 40;
  doc.setFontSize(7);
  const split = doc.splitTextToSize(OFFICIAL_REPORT_DISCLAIMER, 180);
  doc.text(split, 14, Math.min(disclaimerY + 10, 270));

  doc.save(`informe_registro_horario_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

export function downloadEnhancedLaborReportExcel(
  bundle: LaborReportBundle,
  extras?: {
    timeOffRows?: Record<string, string | number>[];
    incidentRows?: Record<string, string | number>[];
  }
) {
  const wb = XLSX.utils.book_new();

  const headerRows = companyHeaderLines(bundle).map((line) => ({ Campo: line }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(headerRows), "Empresa");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Empleado: bundle.employeeFilter,
        Periodo: `${bundle.period.from} → ${bundle.period.to}`,
        Total_horas_netas: bundle.summary.totalHours.toFixed(2),
        Total_horas_brutas: bundle.summary.totalGrossHours.toFixed(2),
        Total_minutos_pausa: bundle.summary.totalBreakMinutes,
        Dias_con_fichaje: bundle.summary.daysWithClock,
        Incompletos: bundle.summary.incompleteDays,
        Corregidos: bundle.summary.correctedCount,
        Anulados: bundle.summary.voidedCount,
        Incidencias: bundle.summary.incidentCount,
      },
    ]),
    "Resumen"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      bundle.rows.map((r) => ({
        Empleado: r.employeeName,
        Usuario: r.employeeUsername,
        Centro: r.workplaceName,
        Fecha: r.date,
        Entrada: r.clockIn ?? "",
        Salida: r.clockOut ?? "",
        Pausas: r.breakLabel,
        Horas_brutas: r.grossHours ?? "",
        Minutos_pausa: r.breakMinutes,
        Horas_netas: r.totalHours ?? "",
        Estado: r.status,
        Retraso: r.isLate ? "Sí" : "No",
        Modificado: r.modified ? "Sí" : "No",
        Modificado_por: r.modifiedBy ?? "",
        Motivo: r.modificationReason ?? "",
        Corregido_el: r.correctedAt ?? "",
        Incidencia_pausa: r.hasOpenBreak ? "Sí" : "No",
      }))
    ),
    "Fichajes"
  );

  if (extras?.timeOffRows?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(extras.timeOffRows), "Vacaciones");
  }
  if (extras?.incidentRows?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(extras.incidentRows), "Incidencias");
  }
  if (bundle.auditHistory.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        bundle.auditHistory.map((a) => ({
          Fecha: new Date(a.performedAt).toLocaleString("es-ES"),
          Accion: a.action,
          Empleado: a.employeeName ?? "",
          Usuario: a.performedByName ?? "",
          Resumen: a.summary,
          Motivo: a.reason ?? "",
        }))
      ),
      "Historial_cambios"
    );
  }

  XLSX.writeFile(wb, `reporte_horas_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
}

export function downloadEnhancedLaborReportPdf(
  bundle: LaborReportBundle,
  extras?: {
    timeOffRows?: string[][];
    incidentRows?: string[][];
  }
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Reporte de horas, vacaciones e incidencias", 14, 14);
  doc.setFontSize(9);
  let y = 20;
  for (const line of companyHeaderLines(bundle)) {
    doc.text(line, 14, y);
    y += 5;
  }
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [["Resumen", "Valor"]],
    body: [
      ["Empleado(s)", bundle.employeeFilter],
      ["Total horas (sin anulados)", bundle.summary.totalHours.toFixed(2)],
      ["Días con fichaje", String(bundle.summary.daysWithClock)],
      ["Anulados (visibles, no suman)", String(bundle.summary.voidedCount)],
    ],
    styles: { fontSize: 8 },
  });

  doc.addPage();
  doc.setFontSize(12);
  doc.text("Fichajes", 14, 14);
  autoTable(doc, {
    startY: 18,
    head: [["Empleado", "Fecha", "Entrada", "Salida", "Pausas", "Horas", "Estado", "Modificado"]],
    body:
      bundle.rows.length > 0
        ? bundle.rows.map((r) => [
            r.employeeName,
            r.date,
            r.clockIn ?? "—",
            r.clockOut ?? "—",
            r.breakLabel,
            r.totalHours != null ? r.totalHours.toFixed(2) : "—",
            r.status,
            r.modified ? (r.modifiedBy ?? "Sí") : "No",
          ])
        : [["Sin datos", "", "", "", "", "", "", ""]],
    styles: { fontSize: 7 },
  });

  if (extras?.timeOffRows?.length) {
    doc.addPage();
    doc.text("Vacaciones / días libres", 14, 14);
    autoTable(doc, {
      startY: 18,
      head: [["Empleado", "Tipo", "Desde", "Hasta", "Estado", "Comentario"]],
      body: extras.timeOffRows,
      styles: { fontSize: 8 },
    });
  }

  if (extras?.incidentRows?.length) {
    doc.addPage();
    doc.text("Incidencias", 14, 14);
    autoTable(doc, {
      startY: 18,
      head: [["Empleado", "Tipo", "Estado", "Motivo", "Fecha"]],
      body: extras.incidentRows,
      styles: { fontSize: 8 },
    });
  }

  if (bundle.auditHistory.length > 0) {
    doc.addPage();
    doc.text("Historial de cambios", 14, 14);
    autoTable(doc, {
      startY: 18,
      head: [["Fecha", "Acción", "Empleado", "Usuario", "Motivo"]],
      body: bundle.auditHistory.map((a) => [
        new Date(a.performedAt).toLocaleString("es-ES"),
        a.action,
        a.employeeName ?? "—",
        a.performedByName ?? "—",
        a.reason ?? "",
      ]),
      styles: { fontSize: 7 },
    });
  }

  doc.setFontSize(7);
  const split = doc.splitTextToSize(OFFICIAL_REPORT_DISCLAIMER, 260);
  doc.text(split, 14, 200);

  doc.save(`reporte_horas_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

export function downloadLegalTemplatePdf(title: string, plainText: string, filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(plainText, 180);
  doc.text(lines, 14, 24);
  doc.save(filename);
}

export function downloadEmployeeDataJson(data: unknown, employeeName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = employeeName.replace(/[^\w.-]+/g, "_").slice(0, 40);
  a.download = `datos_empleado_${safe}_${format(new Date(), "yyyyMMdd")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMonthlyLaborReportCsv(summary: MonthlyEmployeeSummary) {
  const csv = monthlyReportToCsv(summary);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resumen_mensual_${summary.employee.username}_${summary.period.year}${String(summary.period.month).padStart(2, "0")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadInspectionPackageBundle(payload: {
  generatedAt: string;
  checksum: string;
  bundle: LaborReportBundle;
  companyLegal: Record<string, unknown>;
}) {
  const manifest = {
    ...payload,
    disclaimer: OFFICIAL_EXPORT_FOOTER,
    files: ["registro_horario.csv", "registro_horario.json", "datos_legales_empresa.json"],
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inspeccion_trabajo_${format(new Date(), "yyyyMMdd_HHmm")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  downloadLaborReportCsv(payload.bundle);
}
