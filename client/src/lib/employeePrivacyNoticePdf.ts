import { jsPDF } from "jspdf";
import {
  buildEmployeePrivacyNotice,
  noticeDocumentToPlainText,
  type CompanyLegalInfo,
  type EmployeeNoticeContext,
} from "@shared/employeePrivacyNotice";

export function downloadEmployeePrivacyNoticePdf(
  company: CompanyLegalInfo,
  employee?: EmployeeNoticeContext,
  filename?: string
) {
  const doc = buildEmployeePrivacyNotice(company, employee);
  const text = noticeDocumentToPlainText(doc);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  const lines = pdf.splitTextToSize(text, maxWidth);
  let y = margin;
  const lineHeight = 5.5;
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (const line of lines) {
    if (y > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(line, margin, y);
    y += lineHeight;
  }

  if (employee?.employeeName) {
    if (y > pageHeight - 50) {
      pdf.addPage();
      y = margin;
    }
    y += 10;
    pdf.setFontSize(10);
    pdf.text(doc.acknowledgmentLabel, margin, y, { maxWidth });
    y += 20;
    pdf.text(`${doc.signatureBlock.employeeLabel}: _______________________________`, margin, y);
    y += 12;
    pdf.text(`${doc.signatureBlock.dateLabel}: ____ / ____ / ______`, margin, y);
    y += 12;
    pdf.text(`${doc.signatureBlock.placeLabel}: _______________________________`, margin, y);
  }

  const safeName = (employee?.employeeName || company.name || "empresa")
    .replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  pdf.save(filename ?? `clausula-informativa-rgpd-${safeName}.pdf`);
}
