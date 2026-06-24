import { auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";

export type AuditEntityType = "timeclock" | "employee" | "company" | "incident";

export async function writeAuditLog(params: {
  companyId: number;
  entityType: AuditEntityType;
  entityId: number;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  performedByType: "admin" | "employee" | "superadmin" | "system";
  performedById?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    companyId: params.companyId,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    reason: params.reason ?? null,
    performedByType: params.performedByType,
    performedById: params.performedById ?? null,
  });
}
