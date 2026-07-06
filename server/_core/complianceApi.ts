import { createHash } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { LEGAL_TEMPLATES_VERSION, PLATFORM_TERMS_VERSION } from "@shared/const";
import {
  companies,
  companyLegalAcceptances,
  employees,
  gdprRequests,
  legalAcceptances,
  monthlyReportDeliveries,
} from "../../drizzle/schema";
import { getDb, getCompanyById, getRestaurantById } from "../db";
import { buildLaborReportBundle } from "./laborReportBundle";
import { calendarMonthRange } from "@shared/laborReport";
import { buildMonthlyEmployeeSummary } from "@shared/monthlyLaborReport";
import { validateCompanyLegalForOfficialExport } from "@shared/legalCompliance";
import { writeAuditLog } from "./audit";

export function hashDocumentContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function buildMonthlyEmployeeReport(input: {
  companyId: number;
  adminId: number;
  employeeId: number;
  year: number;
  month: number;
}) {
  const { from, to } = calendarMonthRange(input.year, input.month);
  const bundle = await buildLaborReportBundle({
    companyId: input.companyId,
    adminId: input.adminId,
    employeeId: input.employeeId,
    dateFrom: from,
    dateTo: to,
    includeAuditHistory: true,
  });
  const row = bundle.rows[0];
  const db = await getDb();
  const [emp] = db
    ? await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, input.employeeId), eq(employees.companyId, input.companyId)))
        .limit(1)
    : [];
  const employee = emp ?? {
    id: input.employeeId,
    name: row?.employeeName ?? "Empleado",
    username: row?.employeeUsername ?? "",
    isActive: true,
    nationalId: null,
    contractType: "full_time" as const,
    weeklyContractedHours: null,
  };
  return buildMonthlyEmployeeSummary({
    employee: {
      id: employee.id,
      name: employee.name,
      username: employee.username,
      isActive: employee.isActive ?? true,
      workplaceName: bundle.workplace.name,
      nationalId: (employee as { nationalId?: string | null }).nationalId ?? null,
      contractType: (employee as { contractType?: "full_time" }).contractType ?? "full_time",
      weeklyContractedHours: (employee as { weeklyContractedHours?: string | null }).weeklyContractedHours
        ? Number((employee as { weeklyContractedHours?: string | null }).weeklyContractedHours)
        : null,
    },
    year: input.year,
    month: input.month,
    rows: bundle.rows,
    incidentCount: bundle.summary.incidentCount,
    generatedAt: bundle.generatedAt,
  });
}

export async function buildInspectionPackage(input: {
  companyId: number;
  adminId: number;
  dateFrom: string;
  dateTo: string;
  employeeId?: number;
}) {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new Error("Empresa no encontrada");
  const legal = validateCompanyLegalForOfficialExport(company);
  if (!legal.valid) {
    throw new Error(
      `Faltan datos legales de empresa (${legal.missing.join(", ")}). Complete el panel Legal/RGPD.`
    );
  }
  const bundle = await buildLaborReportBundle({
    companyId: input.companyId,
    adminId: input.adminId,
    employeeId: input.employeeId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    includeAuditHistory: true,
  });
  const generatedAt = new Date().toISOString();
  const payload = JSON.stringify(bundle);
  const checksum = hashDocumentContent(payload);
  await writeAuditLog({
    companyId: input.companyId,
    entityType: "company",
    entityId: input.companyId,
    action: "EXPORT_GENERATED",
    newValue: {
      type: "inspection_package",
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      checksum,
    },
    performedByType: "admin",
    performedById: input.adminId,
  });
  return {
    generatedAt,
    checksum,
    bundle,
    companyLegal: {
      name: company.name,
      legalName: company.legalName,
      taxId: company.taxId,
      address: company.address,
      privacyContactEmail: company.privacyContactEmail,
    },
  };
}

export async function recordMonthlyReportDelivery(input: {
  companyId: number;
  employeeId: number;
  year: number;
  month: number;
  deliveryType: "admin_generated" | "employee_downloaded" | "admin_delivered";
  documentHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(monthlyReportDeliveries).values({
    companyId: input.companyId,
    employeeId: input.employeeId,
    periodYear: input.year,
    periodMonth: input.month,
    deliveryType: input.deliveryType,
    documentHash: input.documentHash,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

export async function getEmployeeLegalPortalData(employeeId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const company = await getCompanyById(companyId);
  const acceptances = await db
    .select()
    .from(legalAcceptances)
    .where(eq(legalAcceptances.employeeId, employeeId))
    .orderBy(desc(legalAcceptances.acceptedAt));
  return {
    companyName: company?.name ?? "",
    locationEnabled: company?.locationEnabled ?? false,
    acceptances: acceptances.map((a) => ({
      documentVersion: a.documentVersion,
      acceptedAt: a.acceptedAt,
      documentType: a.documentType,
    })),
    gdprErasureNotice:
      "La supresión puede no ser procedente cuando exista obligación legal de conservar los registros horarios.",
  };
}

export async function createGdprRequest(input: {
  companyId: number;
  employeeId: number;
  requestType:
    | "access"
    | "rectification"
    | "erasure"
    | "restriction"
    | "objection"
    | "portability"
    | "other";
  message: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .insert(gdprRequests)
    .values({
      companyId: input.companyId,
      employeeId: input.employeeId,
      requestType: input.requestType,
      message: input.message,
      status: "received",
    })
    .returning({ id: gdprRequests.id });
  return { id: row.id };
}

export async function listGdprRequestsForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(gdprRequests)
    .where(eq(gdprRequests.companyId, companyId))
    .orderBy(desc(gdprRequests.createdAt));
}

export async function countPendingGdprRequests(companyId: number) {
  const rows = await listGdprRequestsForCompany(companyId);
  return rows.filter((r) => r.status === "received" || r.status === "in_review").length;
}

export async function buildEmployeeSelfLaborReport(
  employeeId: number,
  companyId: number,
  dateFrom: string,
  dateTo: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [emp] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)))
    .limit(1);
  if (!emp) throw new Error("Empleado no encontrado");
  const restaurant = await getRestaurantById(emp.restaurantId, companyId);
  if (!restaurant) throw new Error("Centro no encontrado");
  return buildLaborReportBundle({
    companyId,
    adminId: restaurant.adminId,
    employeeId,
    dateFrom,
    dateTo,
    includeAuditHistory: false,
  });
}

const COMPANY_SAAS_DOCUMENTS = [
  { code: "terms_of_use" as const, version: PLATFORM_TERMS_VERSION, title: "Términos de uso" },
  { code: "privacy_policy" as const, version: LEGAL_TEMPLATES_VERSION, title: "Política de privacidad SaaS" },
  { code: "dpa" as const, version: LEGAL_TEMPLATES_VERSION, title: "Acuerdo de encargado del tratamiento (DPA)" },
];

export async function recordCompanyLegalAcceptances(input: {
  companyId: number;
  acceptedByUserId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const doc of COMPANY_SAAS_DOCUMENTS) {
    const documentHash = hashDocumentContent(`${doc.code}:${doc.version}`);
    const existing = await db
      .select({ id: companyLegalAcceptances.id })
      .from(companyLegalAcceptances)
      .where(
        and(
          eq(companyLegalAcceptances.companyId, input.companyId),
          eq(companyLegalAcceptances.documentCode, doc.code),
          eq(companyLegalAcceptances.documentVersion, doc.version)
        )
      )
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(companyLegalAcceptances).values({
      companyId: input.companyId,
      acceptedByUserId: input.acceptedByUserId,
      documentCode: doc.code,
      documentVersion: doc.version,
      documentHash,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  }
}

export async function listCompanyLegalAcceptances(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(companyLegalAcceptances)
    .where(eq(companyLegalAcceptances.companyId, companyId))
    .orderBy(desc(companyLegalAcceptances.acceptedAt));
}

export async function getMissingCompanyLegalAcceptances(companyId: number) {
  const accepted = await listCompanyLegalAcceptances(companyId);
  const acceptedKeys = new Set(accepted.map((a) => `${a.documentCode}:${a.documentVersion}`));
  return COMPANY_SAAS_DOCUMENTS.filter((d) => !acceptedKeys.has(`${d.code}:${d.version}`));
}
