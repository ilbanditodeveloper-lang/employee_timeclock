import { eq, and, desc, gte, lt, isNull, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser,
  users,
  employees,
  restaurants,
  schedules,
  timeclocks,
  incidents,
  companies,
  legalAcceptances,
  auditLogs,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { DUPLICATE_ADMIN_EMAIL_MSG } from "@shared/const";
import { isUniqueViolation } from "./_core/errors";
import { isDemoRequestActive } from "./demo/mode";
import {
  getDemoCompany,
  getDemoAdmin,
  getDemoRestaurant,
  getDemoEmployees,
  getDemoEmployeeById,
  getDemoTimeclocks,
  getDemoIncidents,
  getDemoPrivacyAcceptances,
  getDemoAuditLogs,
  getDemoScheduleRows,
  getDemoLatestOpenTimeclock,
  getDemoTodayTimeclocks,
  demoHasPrivacyAcceptance,
} from "./demo/store";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: postgres.Sql | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, { ssl: "require" });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getOrCreateLocalAdmin(name: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get admin: database not available");
    return undefined;
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.openId, "local-admin"))
    .limit(1);

  if (existing.length > 0) return existing[0];

  await db.insert(users).values({
    openId: "local-admin",
    name,
    role: "admin",
    lastSignedIn: new Date(),
  });

  const created = await db
    .select()
    .from(users)
    .where(eq(users.openId, "local-admin"))
    .limit(1);

  return created.length > 0 ? created[0] : undefined;
}

export function normalizeCompanySlug(rawSlug: string | undefined | null): string {
  return (rawSlug ?? "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "default";
}

export async function getCompanyBySlug(rawSlug: string) {
  if (isDemoRequestActive()) {
    const slug = normalizeCompanySlug(rawSlug);
    if (slug === "demo") return getDemoCompany();
    return undefined;
  }
  const db = await getDb();
  if (!db) return undefined;
  const slug = normalizeCompanySlug(rawSlug);
  const result = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrCreateCompanyBySlug(rawSlug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const slug = normalizeCompanySlug(rawSlug);
  const existing = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  if (existing.length > 0) return existing[0];

  const prettyName = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");

  await db.insert(companies).values({
    name: prettyName || "Default Company",
    slug,
    isActive: true,
  });

  const created = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return created.length > 0 ? created[0] : undefined;
}

export async function getCompanyById(companyId: number) {
  if (isDemoRequestActive() && companyId === 1) return getDemoCompany();
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLocalAdminByCompany(companyId: number) {
  if (isDemoRequestActive() && companyId === 1) return getDemoAdmin();
  const db = await getDb();
  if (!db) return undefined;
  const openId = `local-admin-${companyId}`;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalAdminForCompany(params: {
  companyId: number;
  name: string;
  password: string;
  email?: string;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const openId = `local-admin-${params.companyId}`;
  await db.insert(users).values({
    companyId: params.companyId,
    openId,
    name: params.name,
    email: params.email ? normalizeAdminEmail(params.email) : null,
    role: "admin",
    password: params.password,
    lastSignedIn: new Date(),
  });
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export function sanitizeAdminUsernameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  let username = localPart
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
  if (!username) username = "admin";
  return username;
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getAdminUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = normalizeAdminEmail(email);
  const result = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.role, "admin"),
        sql`lower(${users.email}) = ${normalized}`,
        sql`${users.openId} LIKE 'local-admin-%'`
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function findAdminsByLoginName(loginName: string) {
  const db = await getDb();
  if (!db) return [];
  const normalized = loginName.trim().toLowerCase();
  return db
    .select({ user: users, company: companies })
    .from(users)
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(
      and(
        eq(users.role, "admin"),
        sql`lower(${users.name}) = ${normalized}`,
        sql`${users.openId} LIKE 'local-admin-%'`,
        eq(companies.isActive, true)
      )
    );
}

export async function findEmployeesByLoginUsername(username: string) {
  const db = await getDb();
  if (!db) return [];
  const normalized = username.trim().toLowerCase();
  return db
    .select({ employee: employees, company: companies })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(
      and(
        sql`lower(trim(${employees.username})) = ${normalized}`,
        eq(employees.isActive, true),
        eq(companies.isActive, true)
      )
    );
}

async function slugExistsInDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  slug: string
): Promise<boolean> {
  const result = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).limit(1);
  return result.length > 0;
}

export async function generateUniqueCompanySlug(businessName: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let base = normalizeCompanySlug(businessName);
  if (!base || base === "default") base = "negocio";
  let candidate = base;
  let suffix = 2;
  while (await slugExistsInDb(db, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function ensureUniqueAdminUsernameInCompany(
  db: Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "select">,
  companyId: number,
  baseUsername: string
): Promise<string> {
  let candidate = baseUsername;
  let suffix = 2;
  for (;;) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.companyId, companyId), eq(users.name, candidate)))
      .limit(1);
    if (existing.length === 0) return candidate;
    candidate = `${baseUsername}${suffix}`;
    suffix += 1;
  }
}

const MADRID_LAT = "40.41680000";
const MADRID_LNG = "-3.70380000";

export type RegisterBusinessParams = {
  businessName: string;
  adminName: string;
  email: string;
  passwordHash: string;
  country: string;
  timezone: string;
  address?: string;
};

export type RegisterBusinessResult = {
  companyId: number;
  companySlug: string;
  companyName: string;
  adminId: number;
  adminUsername: string;
  adminEmail: string;
  restaurantId: number;
};

export async function registerBusinessTenant(
  params: RegisterBusinessParams
): Promise<RegisterBusinessResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedEmail = normalizeAdminEmail(params.email);
  const existingEmail = await getAdminUserByEmail(normalizedEmail);
  if (existingEmail) {
    throw new Error(DUPLICATE_ADMIN_EMAIL_MSG);
  }

  const slug = await generateUniqueCompanySlug(params.businessName);
  const baseUsername = sanitizeAdminUsernameFromEmail(normalizedEmail);
  const restaurantAddress = params.address?.trim() || "Pendiente de configurar";
  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
    const [company] = await tx
      .insert(companies)
      .values({
        name: params.businessName.trim(),
        slug,
        legalName: params.adminName.trim(),
        address: params.address?.trim() || null,
        privacyContactEmail: normalizedEmail,
        country: params.country.trim().toUpperCase().slice(0, 2) || "ES",
        timezone: params.timezone.trim() || "Europe/Madrid",
        locationEnabled: false,
        dataRetentionYears: 4,
        termsAcceptedAt: now,
        onboardingCompleted: false,
        isActive: true,
      })
      .returning();

    if (!company) {
      throw new Error("No se pudo crear la empresa");
    }

    const adminUsername = await ensureUniqueAdminUsernameInCompany(tx, company.id, baseUsername);
    const openId = `local-admin-${company.id}`;

    const [admin] = await tx
      .insert(users)
      .values({
        companyId: company.id,
        openId,
        name: adminUsername,
        email: normalizedEmail,
        role: "admin",
        password: params.passwordHash,
        lastSignedIn: now,
      })
      .returning();

    if (!admin) {
      throw new Error("No se pudo crear el administrador");
    }

    const [restaurant] = await tx
      .insert(restaurants)
      .values({
        companyId: company.id,
        name: params.businessName.trim(),
        address: restaurantAddress,
        latitude: MADRID_LAT,
        longitude: MADRID_LNG,
        radiusMeters: 150,
        adminId: admin.id,
      })
      .returning();

    if (!restaurant) {
      throw new Error("No se pudo crear el local inicial");
    }

    await tx
      .update(users)
      .set({ restaurantId: restaurant.id, updatedAt: now })
      .where(eq(users.id, admin.id));

    return {
      companyId: company.id,
      companySlug: company.slug,
      companyName: company.name,
      adminId: admin.id,
      adminUsername,
      adminEmail: normalizedEmail,
      restaurantId: restaurant.id,
    };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error(DUPLICATE_ADMIN_EMAIL_MSG);
    }
    throw error;
  }
}

// Employee queries
export async function getEmployeeById(id: number, companyId?: number) {
  if (isDemoRequestActive()) {
    const employee = getDemoEmployeeById(id);
    if (!employee) return undefined;
    if (companyId && employee.companyId !== companyId) return undefined;
    return employee;
  }
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(eq(employees.id, id), eq(employees.companyId, companyId))
    : eq(employees.id, id);
  const result = await db.select().from(employees).where(where).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getEmployeesByRestaurant(restaurantId: number, companyId?: number) {
  if (isDemoRequestActive()) {
    return getDemoEmployees().filter(
      (e) =>
        e.restaurantId === restaurantId && (!companyId || e.companyId === companyId)
    );
  }
  const db = await getDb();
  if (!db) return [];
  const where = companyId
    ? and(eq(employees.restaurantId, restaurantId), eq(employees.companyId, companyId))
    : eq(employees.restaurantId, restaurantId);
  return await db.select().from(employees).where(where);
}

export function normalizeEmployeeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findEmployeesByLoginEmail(email: string) {
  const db = await getDb();
  if (!db) return [];
  const normalized = normalizeEmployeeEmail(email);
  return db
    .select({ employee: employees, company: companies })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(
      and(
        sql`lower(trim(${employees.email})) = ${normalized}`,
        eq(employees.isActive, true),
        eq(companies.isActive, true)
      )
    );
}

export async function getEmployeeByEmail(email: string, companyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = normalizeEmployeeEmail(email);
  const result = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.companyId, companyId),
        sql`lower(trim(${employees.email})) = ${normalized}`
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getEmployeeByUsername(username: string, companyId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(eq(employees.username, username), eq(employees.companyId, companyId))
    : eq(employees.username, username);
  const result = await db.select().from(employees).where(where).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Restaurant queries
export async function getRestaurantById(id: number, companyId?: number) {
  if (isDemoRequestActive()) {
    const r = getDemoRestaurant();
    if (r.id !== id) return undefined;
    if (companyId && r.companyId !== companyId) return undefined;
    return r;
  }
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(eq(restaurants.id, id), eq(restaurants.companyId, companyId))
    : eq(restaurants.id, id);
  const result = await db.select().from(restaurants).where(where).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRestaurantByAdmin(adminId: number, companyId?: number) {
  if (isDemoRequestActive()) {
    const r = getDemoRestaurant();
    if (r.adminId !== adminId) return undefined;
    if (companyId && r.companyId !== companyId) return undefined;
    return r;
  }
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(eq(restaurants.adminId, adminId), eq(restaurants.companyId, companyId))
    : eq(restaurants.adminId, adminId);
  const result = await db.select().from(restaurants).where(where).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Schedule queries
export async function getSchedulesByEmployee(employeeId: number, companyId?: number) {
  if (isDemoRequestActive()) {
    return getDemoScheduleRows(employeeId);
  }
  const db = await getDb();
  if (!db) return [];
  const where = companyId
    ? and(eq(schedules.employeeId, employeeId), eq(schedules.companyId, companyId))
    : eq(schedules.employeeId, employeeId);
  return await db.select().from(schedules).where(where);
}

export async function getScheduleByEmployeeAndDay(
  employeeId: number,
  dayOfWeek: number,
  companyId?: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(
        eq(schedules.employeeId, employeeId),
        eq(schedules.dayOfWeek, dayOfWeek),
        eq(schedules.companyId, companyId)
      )
    : and(eq(schedules.employeeId, employeeId), eq(schedules.dayOfWeek, dayOfWeek));
  const result = await db.select().from(schedules)
    .where(where)
    .orderBy(schedules.entrySlot)
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getScheduleByEmployeeDayAndSlot(
  employeeId: number,
  dayOfWeek: number,
  entrySlot: number,
  companyId?: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(
        eq(schedules.employeeId, employeeId),
        eq(schedules.dayOfWeek, dayOfWeek),
        eq(schedules.entrySlot, entrySlot),
        eq(schedules.companyId, companyId)
      )
    : and(
        eq(schedules.employeeId, employeeId),
        eq(schedules.dayOfWeek, dayOfWeek),
        eq(schedules.entrySlot, entrySlot)
      );
  const result = await db
    .select()
    .from(schedules)
    .where(where)
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Timeclock queries
export async function getTimeclocksByEmployee(employeeId: number, companyId?: number) {
  if (isDemoRequestActive()) {
    return getDemoTimeclocks([employeeId]);
  }
  const db = await getDb();
  if (!db) return [];
  const where = companyId
    ? and(eq(timeclocks.employeeId, employeeId), eq(timeclocks.companyId, companyId))
    : eq(timeclocks.employeeId, employeeId);
  return await db.select().from(timeclocks).where(where);
}

export async function getTodayTimeclocksByEmployee(
  employeeId: number,
  date = new Date(),
  companyId?: number
) {
  if (isDemoRequestActive()) {
    return getDemoTodayTimeclocks(employeeId);
  }
  const db = await getDb();
  if (!db) return [];

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return await db
    .select()
    .from(timeclocks)
    .where(
      and(
        eq(timeclocks.employeeId, employeeId),
        ...(companyId ? [eq(timeclocks.companyId, companyId)] : []),
        gte(timeclocks.createdAt, dayStart),
        lt(timeclocks.createdAt, dayEnd)
      )
    )
    .orderBy(desc(timeclocks.createdAt));
}

export async function getLatestOpenTimeclockByEmployee(employeeId: number, companyId?: number) {
  if (isDemoRequestActive()) {
    return getDemoLatestOpenTimeclock(employeeId);
  }
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(timeclocks)
    .where(
      and(
        eq(timeclocks.employeeId, employeeId),
        ...(companyId ? [eq(timeclocks.companyId, companyId)] : []),
        isNull(timeclocks.exitTime)
      )
    )
    .orderBy(desc(timeclocks.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTimeclockById(id: number, companyId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(eq(timeclocks.id, id), eq(timeclocks.companyId, companyId))
    : eq(timeclocks.id, id);
  const result = await db.select().from(timeclocks).where(where).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Incident queries
export async function getIncidentsByEmployee(employeeId: number, companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  const where = companyId
    ? and(eq(incidents.employeeId, employeeId), eq(incidents.companyId, companyId))
    : eq(incidents.employeeId, employeeId);
  return await db.select().from(incidents).where(where);
}

export async function getIncidentById(id: number, companyId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(eq(incidents.id, id), eq(incidents.companyId, companyId))
    : eq(incidents.id, id);
  const result = await db.select().from(incidents).where(where).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLegalAcceptance(
  employeeId: number,
  documentType: "employee_privacy_notice" | "platform_terms",
  documentVersion: string
) {
  if (isDemoRequestActive() && documentType === "employee_privacy_notice") {
    if (!demoHasPrivacyAcceptance(employeeId)) return undefined;
    return {
      id: employeeId,
      companyId: 1,
      employeeId,
      documentType,
      documentVersion,
      acceptedAt: new Date(),
      ipAddress: "127.0.0.1",
    };
  }
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(legalAcceptances)
    .where(
      and(
        eq(legalAcceptances.employeeId, employeeId),
        eq(legalAcceptances.documentType, documentType),
        eq(legalAcceptances.documentVersion, documentVersion)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listEmployeePrivacyAcceptances(
  companyId: number,
  restaurantId: number,
  documentVersion: string
) {
  if (isDemoRequestActive()) {
    return getDemoPrivacyAcceptances();
  }
  const db = await getDb();
  if (!db) return [];
  const emps = await getEmployeesByRestaurant(restaurantId, companyId);
  const rows = [];
  for (const emp of emps) {
    const acceptance = await getLegalAcceptance(
      emp.id,
      "employee_privacy_notice",
      documentVersion
    );
    rows.push({
      employeeId: emp.id,
      employeeName: emp.name,
      username: emp.username,
      isActive: emp.isActive,
      acceptedAt: acceptance?.acceptedAt ?? null,
      ipAddress: acceptance?.ipAddress ?? null,
      documentVersion: acceptance?.documentVersion ?? null,
    });
  }
  return rows;
}

export async function listAuditLogsByCompany(companyId: number, limit = 100) {
  if (isDemoRequestActive()) return getDemoAuditLogs();
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.companyId, companyId))
    .orderBy(desc(auditLogs.performedAt))
    .limit(limit);
}

export async function listTimeclocksForEmployeeIds(employeeIds: number[], companyId: number) {
  if (isDemoRequestActive()) return getDemoTimeclocks(employeeIds);
  const db = await getDb();
  if (!db || employeeIds.length === 0) return [];
  return db
    .select()
    .from(timeclocks)
    .where(and(eq(timeclocks.companyId, companyId), inArray(timeclocks.employeeId, employeeIds)))
    .orderBy(desc(timeclocks.entryTime));
}

export async function listIncidentsForEmployeeIds(employeeIds: number[], companyId: number) {
  if (isDemoRequestActive()) return getDemoIncidents(employeeIds);
  const db = await getDb();
  if (!db || employeeIds.length === 0) return [];
  return db
    .select()
    .from(incidents)
    .where(and(eq(incidents.companyId, companyId), inArray(incidents.employeeId, employeeIds)))
    .orderBy(desc(incidents.createdAt));
}
