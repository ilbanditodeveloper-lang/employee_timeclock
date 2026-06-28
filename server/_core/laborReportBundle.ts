import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  auditLogs,
  employees,
  incidents,
  legalAcceptances,
  timeOffRequests,
  timeclocks,
  users,
} from "../../drizzle/schema";
import { getDb, getCompanyById, getEmployeesByRestaurant, getRestaurantByAdmin, listIncidentsForEmployeeIds } from "../db";
import { isDemoRequestActive } from "../demo/mode";
import {
  getDemoCompany,
  getDemoEmployees,
  getDemoRestaurant,
  getDemoTimeclocks,
  getDemoIncidents,
  getDemoAuditLogs,
} from "../demo/store";
import type { LaborReportAuditEntry, LaborReportBundle, LaborReportDayRow, TimeclockStatus } from "@shared/laborReport";
import {
  buildLaborReportSummary,
  computeHoursFromMinutes,
  computeMinutes,
  formatIsoInTimezone,
  rowStatusLabel,
  summarizeAuditChange,
  toYmdFromDate,
} from "@shared/laborReport";

export type LaborReportInput = {
  companyId: number;
  adminId: number;
  employeeId?: number;
  dateFrom: string;
  dateTo: string;
  includeAuditHistory?: boolean;
};

export type AuditLogFilterInput = {
  companyId: number;
  dateFrom?: string;
  dateTo?: string;
  entityType?: "timeclock" | "employee" | "company" | "incident";
  action?: string;
  employeeId?: number;
  limit?: number;
};

export type EnrichedAuditLogRow = {
  id: number;
  performedAt: Date;
  action: string;
  entityType: string;
  entityId: number;
  reason: string | null;
  oldValue: unknown;
  newValue: unknown;
  performedByType: string;
  performedById: number | null;
  performedByName: string | null;
  affectedEmployeeId: number | null;
  affectedEmployeeName: string | null;
  summary: string;
};

function parseDayBounds(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T23:59:59.999Z`);
  return { start, end };
}

function modifierName(userMap: Map<number, string>, userId: number | null | undefined): string | null {
  if (!userId) return null;
  return userMap.get(userId) ?? `Admin #${userId}`;
}

export async function buildLaborReportBundle(input: LaborReportInput): Promise<LaborReportBundle> {
  if (isDemoRequestActive()) return buildDemoLaborReportBundle(input);

  const company = await getCompanyById(input.companyId);
  if (!company) throw new Error("Empresa no encontrada");

  const restaurant = await getRestaurantByAdmin(input.adminId, input.companyId);
  if (!restaurant) throw new Error("Negocio no encontrado");

  const allEmployees = await getEmployeesByRestaurant(restaurant.id, input.companyId);
  const targetEmployees = input.employeeId
    ? allEmployees.filter((e) => e.id === input.employeeId)
    : allEmployees;

  if (input.employeeId && targetEmployees.length === 0) throw new Error("Empleado no encontrado");

  const employeeIds = targetEmployees.map((e) => e.id);
  const tz = company.timezone || "Europe/Madrid";
  const { start, end } = parseDayBounds(input.dateFrom, input.dateTo);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tcRows =
    employeeIds.length === 0
      ? []
      : await db
          .select()
          .from(timeclocks)
          .where(
            and(
              eq(timeclocks.companyId, input.companyId),
              inArray(timeclocks.employeeId, employeeIds),
              gte(timeclocks.entryTime, start),
              lte(timeclocks.entryTime, end)
            )
          )
          .orderBy(timeclocks.entryTime);

  const adminUsers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.companyId, input.companyId));
  const userMap = new Map(adminUsers.map((u) => [u.id, u.name || u.email || `Admin #${u.id}`]));

  const empMap = new Map(targetEmployees.map((e) => [e.id, e]));
  const workplaceName = restaurant.name;

  const rows: LaborReportDayRow[] = [];
  for (const tc of tcRows) {
    const emp = empMap.get(tc.employeeId);
    if (!emp) continue;
    const entryDate = tc.entryTime ? new Date(tc.entryTime) : new Date(tc.createdAt);
    const hasExit = Boolean(tc.exitTime);
    const st = rowStatusLabel(tc.status as TimeclockStatus, hasExit);
    const minutes = tc.status === "voided" ? null : computeMinutes(tc.entryTime, tc.exitTime);
    const modifiedById = tc.correctedByUserId ?? tc.voidedByUserId;
    rows.push({
      timeclockId: tc.id,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeUsername: emp.username,
      workplaceName,
      date: toYmdFromDate(entryDate, tz),
      clockIn: tc.entryTime ? formatIsoInTimezone(tc.entryTime, tz) : null,
      clockOut: tc.exitTime ? formatIsoInTimezone(tc.exitTime, tz) : null,
      breakStart: null,
      breakEnd: null,
      breakLabel: "No registradas",
      totalMinutes: minutes,
      totalHours: computeHoursFromMinutes(minutes),
      status: st.label,
      statusCode: st.code,
      isLate: tc.isLate,
      modified: tc.status === "corrected" || tc.status === "voided",
      modifiedBy: modifierName(userMap, modifiedById),
      modificationReason: tc.correctionReason ?? tc.voidReason ?? null,
      notes: tc.voidReason ?? tc.correctionReason ?? null,
    });
  }

  const incidentRows = await listIncidentsForEmployeeIds(employeeIds, input.companyId);
  const incidentInRange = incidentRows.filter((inc) => {
    const d = new Date(inc.createdAt);
    return d >= start && d <= end;
  });

  let auditHistory: LaborReportAuditEntry[] = [];
  if (input.includeAuditHistory) {
    const auditRows = await listAuditLogsFiltered({
      companyId: input.companyId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      employeeId: input.employeeId,
      limit: 500,
    });
    auditHistory = auditRows.map((a) => ({
      id: a.id,
      performedAt: a.performedAt.toISOString(),
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      employeeId: a.affectedEmployeeId,
      employeeName: a.affectedEmployeeName,
      performedByName: a.performedByName,
      reason: a.reason,
      summary: a.summary,
    }));
  }

  return {
    company: {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      taxId: company.taxId,
      address: company.address,
      privacyContactEmail: company.privacyContactEmail,
      timezone: tz,
      dataRetentionYears: company.dataRetentionYears ?? 4,
    },
    workplace: { id: restaurant.id, name: restaurant.name, address: restaurant.address },
    period: { from: input.dateFrom, to: input.dateTo },
    generatedAt: new Date().toISOString(),
    employeeFilter: input.employeeId
      ? targetEmployees[0]?.name ?? `Empleado #${input.employeeId}`
      : "Todos los empleados",
    rows,
    summary: buildLaborReportSummary(rows, incidentInRange.length),
    auditHistory,
  };
}

async function buildDemoLaborReportBundle(input: LaborReportInput): Promise<LaborReportBundle> {
  const company = getDemoCompany();
  const restaurant = getDemoRestaurant();
  const allEmployees = getDemoEmployees();
  const targetEmployees = input.employeeId
    ? allEmployees.filter((e) => e.id === input.employeeId)
    : allEmployees;
  const employeeIds = targetEmployees.map((e) => e.id);
  const tz = company.timezone || "Europe/Madrid";
  const tcRows = getDemoTimeclocks(employeeIds);
  const rows: LaborReportDayRow[] = tcRows.map((tc) => {
    const emp = targetEmployees.find((e) => e.id === tc.employeeId)!;
    const hasExit = Boolean(tc.exitTime);
    const st = rowStatusLabel((tc.status as TimeclockStatus) ?? "valid", hasExit);
    const minutes = tc.status === "voided" ? null : computeMinutes(tc.entryTime, tc.exitTime);
    return {
      timeclockId: tc.id,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeUsername: emp.username,
      workplaceName: restaurant.name,
      date: tc.entryTime ? toYmdFromDate(new Date(tc.entryTime), tz) : "",
      clockIn: tc.entryTime ? formatIsoInTimezone(tc.entryTime, tz) : null,
      clockOut: tc.exitTime ? formatIsoInTimezone(tc.exitTime, tz) : null,
      breakStart: null,
      breakEnd: null,
      breakLabel: "No registradas",
      totalMinutes: minutes,
      totalHours: computeHoursFromMinutes(minutes),
      status: st.label,
      statusCode: st.code,
      isLate: tc.isLate,
      modified: tc.status === "corrected" || tc.status === "voided",
      modifiedBy: null,
      modificationReason: null,
      notes: null,
    };
  });
  return {
    company: {
      id: company.id,
      name: company.name,
      legalName: company.legalName ?? null,
      taxId: company.taxId ?? null,
      address: company.address ?? null,
      privacyContactEmail: company.privacyContactEmail ?? null,
      timezone: tz,
      dataRetentionYears: company.dataRetentionYears ?? 4,
    },
    workplace: { id: restaurant.id, name: restaurant.name, address: restaurant.address },
    period: { from: input.dateFrom, to: input.dateTo },
    generatedAt: new Date().toISOString(),
    employeeFilter: input.employeeId ? targetEmployees[0]?.name ?? "Empleado" : "Todos los empleados",
    rows,
    summary: buildLaborReportSummary(rows, getDemoIncidents(employeeIds).length),
    auditHistory: [],
  };
}

export async function listAuditLogsFiltered(
  input: AuditLogFilterInput
): Promise<EnrichedAuditLogRow[]> {
  if (isDemoRequestActive()) {
    const demoLogs = getDemoAuditLogs() as Array<{
      id: number;
      performedAt: Date;
      action: string;
      entityType: string;
      entityId: number;
      reason?: string | null;
      oldValue: unknown;
      newValue: unknown;
      performedByType: string;
      performedById?: number | null;
    }>;
    return demoLogs.map((log) => ({
      id: log.id,
      performedAt: log.performedAt,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      reason: log.reason ?? null,
      oldValue: log.oldValue,
      newValue: log.newValue,
      performedByType: log.performedByType,
      performedById: log.performedById ?? null,
      performedByName: "Demo Admin",
      affectedEmployeeId: null,
      affectedEmployeeName: null,
      summary: summarizeAuditChange(log.action, log.oldValue, log.newValue),
    }));
  }

  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(auditLogs.companyId, input.companyId)];
  if (input.dateFrom) {
    conditions.push(gte(auditLogs.performedAt, new Date(`${input.dateFrom}T00:00:00.000Z`)));
  }
  if (input.dateTo) {
    conditions.push(lte(auditLogs.performedAt, new Date(`${input.dateTo}T23:59:59.999Z`)));
  }
  if (input.entityType) conditions.push(eq(auditLogs.entityType, input.entityType));
  if (input.action) conditions.push(eq(auditLogs.action, input.action));

  const raw = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.performedAt))
    .limit(input.limit ?? 200);

  const adminUsers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.companyId, input.companyId));
  const userMap = new Map(adminUsers.map((u) => [u.id, u.name || u.email || `Admin #${u.id}`]));

  const companyEmployees = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.companyId, input.companyId));
  const employeeMap = new Map(companyEmployees.map((e) => [e.id, e.name]));

  const timeclockIds = raw.filter((r) => r.entityType === "timeclock").map((r) => r.entityId);
  const tcEmployeeMap = new Map<number, number>();
  if (timeclockIds.length > 0) {
    const tcs = await db
      .select({ id: timeclocks.id, employeeId: timeclocks.employeeId })
      .from(timeclocks)
      .where(and(eq(timeclocks.companyId, input.companyId), inArray(timeclocks.id, timeclockIds)));
    for (const tc of tcs) tcEmployeeMap.set(tc.id, tc.employeeId);
  }

  const enriched: EnrichedAuditLogRow[] = [];
  for (const log of raw) {
    let affectedEmployeeId: number | null = null;
    if (log.entityType === "employee") affectedEmployeeId = log.entityId;
    else if (log.entityType === "timeclock") affectedEmployeeId = tcEmployeeMap.get(log.entityId) ?? null;

    if (input.employeeId && affectedEmployeeId !== input.employeeId) continue;

    enriched.push({
      id: log.id,
      performedAt: log.performedAt,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      reason: log.reason,
      oldValue: log.oldValue,
      newValue: log.newValue,
      performedByType: log.performedByType,
      performedById: log.performedById,
      performedByName:
        log.performedByType === "admin" && log.performedById
          ? userMap.get(log.performedById) ?? `Admin #${log.performedById}`
          : log.performedByType,
      affectedEmployeeId,
      affectedEmployeeName: affectedEmployeeId ? employeeMap.get(affectedEmployeeId) ?? null : null,
      summary: summarizeAuditChange(log.action, log.oldValue, log.newValue),
    });
  }
  return enriched;
}

export async function buildEmployeeExportBundle(companyId: number, adminId: number, employeeId: number) {
  if (isDemoRequestActive()) {
    const emp = getDemoEmployees().find((e) => e.id === employeeId);
    if (!emp) throw new Error("Empleado no encontrado");
    return {
      exportedAt: new Date().toISOString(),
      disclaimer:
        "Exportación orientativa para derecho de acceso. Revisar con asesoría antes de uso oficial.",
      employee: emp,
      timeclocks: getDemoTimeclocks([employeeId]),
      incidents: getDemoIncidents([employeeId]),
      timeOffRequests: [],
      legalAcceptances: [],
      auditLogs: [],
    };
  }

  const restaurant = await getRestaurantByAdmin(adminId, companyId);
  if (!restaurant) throw new Error("Negocio no encontrado");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [emp] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.companyId, companyId),
        eq(employees.restaurantId, restaurant.id)
      )
    )
    .limit(1);
  if (!emp) throw new Error("Empleado no encontrado");

  const [tcList, incList, toList, laList] = await Promise.all([
    db
      .select()
      .from(timeclocks)
      .where(and(eq(timeclocks.companyId, companyId), eq(timeclocks.employeeId, employeeId)))
      .orderBy(desc(timeclocks.entryTime)),
    db
      .select()
      .from(incidents)
      .where(and(eq(incidents.companyId, companyId), eq(incidents.employeeId, employeeId)))
      .orderBy(desc(incidents.createdAt)),
    db
      .select()
      .from(timeOffRequests)
      .where(and(eq(timeOffRequests.companyId, companyId), eq(timeOffRequests.employeeId, employeeId)))
      .orderBy(desc(timeOffRequests.createdAt)),
    db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.employeeId, employeeId))
      .orderBy(desc(legalAcceptances.acceptedAt)),
  ]);

  const auditRows = await listAuditLogsFiltered({ companyId, employeeId, limit: 500 });

  return {
    exportedAt: new Date().toISOString(),
    disclaimer:
      "Exportación orientativa para derecho de acceso. Revisar con asesoría antes de uso oficial.",
    employee: {
      id: emp.id,
      name: emp.name,
      username: emp.username,
      phone: emp.phone,
      isActive: emp.isActive,
      restaurantId: emp.restaurantId,
      createdAt: emp.createdAt,
    },
    timeclocks: tcList,
    incidents: incList,
    timeOffRequests: toList,
    legalAcceptances: laList,
    auditLogs: auditRows,
  };
}
