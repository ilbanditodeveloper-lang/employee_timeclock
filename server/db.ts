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
  timeclockBreaks,
  timeOffRequests,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { DUPLICATE_ADMIN_EMAIL_MSG } from "@shared/const";
import { APP_TIMEZONE, todayYmdInTimeZone } from "@shared/timezone";
import { addTrialDays } from "@shared/subscriptionPlans";
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
  getDemoOpenBreak,
  closeDemoOpenBreak,
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

export async function countEmployeesByCompany(companyIds: number[]) {
  if (companyIds.length === 0) return new Map<number, number>();
  if (isDemoRequestActive()) {
    const demoCount = getDemoEmployees().length;
    return new Map(companyIds.map((id) => [id, id === 1 ? demoCount : 0]));
  }
  const db = await getDb();
  if (!db) return new Map<number, number>();
  const rows = await db
    .select({
      companyId: employees.companyId,
      total: sql<number>`count(*)::int`,
    })
    .from(employees)
    .where(inArray(employees.companyId, companyIds))
    .groupBy(employees.companyId);
  return new Map(rows.map((row) => [row.companyId, row.total]));
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
  trialDays?: number;
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
        subscriptionPlan: "trial",
        trialEndsAt: addTrialDays(now, params.trialDays && params.trialDays > 0 ? params.trialDays : undefined),
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
        isPrimary: true,
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

export async function getRestaurantsByCompany(companyId: number) {
  if (isDemoRequestActive()) {
    return [getDemoRestaurant()];
  }
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(restaurants)
    .where(eq(restaurants.companyId, companyId))
    .orderBy(desc(restaurants.isPrimary), restaurants.id);
}

export async function countRestaurantsByCompany(companyId: number): Promise<number> {
  const list = await getRestaurantsByCompany(companyId);
  return list.length;
}

export async function createCompanyLocation(params: {
  companyId: number;
  adminId: number;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getRestaurantsByCompany(params.companyId);
  const isPrimary = existing.length === 0;

  const [created] = await db
    .insert(restaurants)
    .values({
      companyId: params.companyId,
      name: params.name.trim(),
      address: params.address?.trim() || null,
      latitude: params.latitude.toString(),
      longitude: params.longitude.toString(),
      radiusMeters: params.radiusMeters,
      adminId: params.adminId,
      isPrimary,
    })
    .returning();

  return created;
}

export async function updateCompanyLocation(
  locationId: number,
  companyId: number,
  patch: {
    name?: string;
    address?: string | null;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getRestaurantById(locationId, companyId);
  if (!existing) throw new Error("Sede no encontrada");

  await db
    .update(restaurants)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.address !== undefined ? { address: patch.address?.trim() || null } : {}),
      ...(patch.latitude !== undefined ? { latitude: patch.latitude.toString() } : {}),
      ...(patch.longitude !== undefined ? { longitude: patch.longitude.toString() } : {}),
      ...(patch.radiusMeters !== undefined ? { radiusMeters: patch.radiusMeters } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(restaurants.id, locationId), eq(restaurants.companyId, companyId)));

  return getRestaurantById(locationId, companyId);
}

export async function deleteCompanyLocation(locationId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getRestaurantById(locationId, companyId);
  if (!existing) throw new Error("Sede no encontrada");

  const emps = await getEmployeesByRestaurant(locationId, companyId);
  if (emps.length > 0) {
    throw new Error("No se puede eliminar una sede con empleados asignados");
  }

  const all = await getRestaurantsByCompany(companyId);
  if (all.length <= 1) {
    throw new Error("Debe existir al menos una sede");
  }

  await db
    .delete(restaurants)
    .where(and(eq(restaurants.id, locationId), eq(restaurants.companyId, companyId)));

  if (existing.isPrimary) {
    const remaining = await getRestaurantsByCompany(companyId);
    if (remaining[0]) {
      await db
        .update(restaurants)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(restaurants.id, remaining[0].id));
    }
  }
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

export async function resolveAdminRestaurantForCompany(
  adminId: number,
  companyId: number,
  restaurantId?: number
) {
  if (restaurantId) {
    return getRestaurantById(restaurantId, companyId);
  }
  const list = await getRestaurantsByCompany(companyId);
  if (list.length > 0) {
    return list.find((r) => r.isPrimary) ?? list[0];
  }
  if (isDemoRequestActive()) {
    const r = getDemoRestaurant();
    if (r.adminId !== adminId) return undefined;
    if (r.companyId !== companyId) return undefined;
    return r;
  }
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.adminId, adminId), eq(restaurants.companyId, companyId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRestaurantByAdmin(
  adminId: number,
  companyId?: number,
  restaurantId?: number
) {
  if (isDemoRequestActive()) {
    const r = getDemoRestaurant();
    if (r.adminId !== adminId) return undefined;
    if (companyId && r.companyId !== companyId) return undefined;
    return r;
  }
  if (!companyId) {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.adminId, adminId))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }
  return resolveAdminRestaurantForCompany(adminId, companyId, restaurantId);
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
  companyId?: number,
  timeZone = APP_TIMEZONE
) {
  if (isDemoRequestActive()) {
    return getDemoTodayTimeclocks(employeeId);
  }
  const db = await getDb();
  if (!db) return [];

  const todayYmd = todayYmdInTimeZone(timeZone, date);

  return await db
    .select()
    .from(timeclocks)
    .where(
      and(
        eq(timeclocks.employeeId, employeeId),
        ...(companyId ? [eq(timeclocks.companyId, companyId)] : []),
        sql`${timeclocks.entryTime}::date = ${todayYmd}::date`
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

export async function getOpenBreakForTimeclock(timeclockId: number, companyId: number) {
  if (isDemoRequestActive()) {
    return getDemoOpenBreak(timeclockId);
  }
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(timeclockBreaks)
    .where(
      and(
        eq(timeclockBreaks.timeclockId, timeclockId),
        eq(timeclockBreaks.companyId, companyId),
        isNull(timeclockBreaks.endedAt)
      )
    )
    .orderBy(desc(timeclockBreaks.startedAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function closeOpenBreakForTimeclock(timeclockId: number, companyId: number, endedAt = new Date()) {
  if (isDemoRequestActive()) {
    return closeDemoOpenBreak(timeclockId, endedAt);
  }
  const db = await getDb();
  if (!db) return;
  await db
    .update(timeclockBreaks)
    .set({ endedAt })
    .where(
      and(
        eq(timeclockBreaks.timeclockId, timeclockId),
        eq(timeclockBreaks.companyId, companyId),
        isNull(timeclockBreaks.endedAt)
      )
    );
}

export async function getEmployeeClockPauseState(employeeId: number, companyId: number) {
  const openTimeclock = await getLatestOpenTimeclockByEmployee(employeeId, companyId);
  if (!openTimeclock) {
    return { isClockedIn: false, isPaused: false, openTimeclockId: null as number | null };
  }
  const openBreak = await getOpenBreakForTimeclock(openTimeclock.id, companyId);
  return {
    isClockedIn: true,
    isPaused: Boolean(openBreak),
    openTimeclockId: openTimeclock.id,
  };
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

export type WorkforceTodaySnapshot = {
  working: { employeeId: number; employeeName: string; entryTime: string | null }[];
  onBreak: { employeeId: number; employeeName: string; entryTime: string | null }[];
  notClockedIn: { employeeId: number; employeeName: string }[];
  onTimeOff: { employeeId: number; employeeName: string; kind: string }[];
  finishedToday: { employeeId: number; employeeName: string; exitTime: string | null }[];
};

export async function getAdminWorkforceToday(
  employees: { id: number; name: string }[],
  companyId: number,
  todayYmd: string
): Promise<WorkforceTodaySnapshot> {
  const empty: WorkforceTodaySnapshot = {
    working: [],
    onBreak: [],
    notClockedIn: [],
    onTimeOff: [],
    finishedToday: [],
  };
  if (employees.length === 0) return empty;

  if (isDemoRequestActive()) {
    const working: WorkforceTodaySnapshot["working"] = [];
    const onBreak: WorkforceTodaySnapshot["onBreak"] = [];
    const clockedInIds = new Set<number>();
    for (const emp of employees) {
      const open = getDemoLatestOpenTimeclock(emp.id);
      if (open) {
        clockedInIds.add(emp.id);
        const item = {
          employeeId: emp.id,
          employeeName: emp.name,
          entryTime: open.entryTime ? new Date(open.entryTime).toISOString() : null,
        };
        if (getDemoOpenBreak(open.id)) onBreak.push(item);
        else working.push(item);
      }
    }
    const notClockedIn = employees
      .filter((e) => !clockedInIds.has(e.id))
      .map((e) => ({ employeeId: e.id, employeeName: e.name }));
    return { ...empty, working, onBreak, notClockedIn };
  }

  const db = await getDb();
  if (!db) return empty;

  const employeeIds = employees.map((e) => e.id);
  const nameById = new Map(employees.map((e) => [e.id, e.name]));

  const openClocks = await db
    .select()
    .from(timeclocks)
    .where(
      and(
        eq(timeclocks.companyId, companyId),
        inArray(timeclocks.employeeId, employeeIds),
        isNull(timeclocks.exitTime),
        sql`${timeclocks.status} != 'voided'`
      )
    );

  const timeOffRows = await db
    .select()
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.companyId, companyId),
        inArray(timeOffRequests.employeeId, employeeIds),
        eq(timeOffRequests.status, "approved"),
        sql`${timeOffRequests.startDate}::text <= ${todayYmd}`,
        sql`${timeOffRequests.endDate}::text >= ${todayYmd}`
      )
    );

  const onTimeOffIds = new Set(timeOffRows.map((r) => r.employeeId));
  const onTimeOff = timeOffRows.map((r) => ({
    employeeId: r.employeeId,
    employeeName: nameById.get(r.employeeId) ?? "—",
    kind: r.kind,
  }));

  const working: WorkforceTodaySnapshot["working"] = [];
  const onBreak: WorkforceTodaySnapshot["onBreak"] = [];
  const clockedInIds = new Set<number>();

  for (const tc of openClocks) {
    clockedInIds.add(tc.employeeId);
    const item = {
      employeeId: tc.employeeId,
      employeeName: nameById.get(tc.employeeId) ?? "—",
      entryTime: tc.entryTime ? new Date(tc.entryTime).toISOString() : null,
    };
    const openBreak = await getOpenBreakForTimeclock(tc.id, companyId);
    if (openBreak) onBreak.push(item);
    else working.push(item);
  }

  const finishedToday: WorkforceTodaySnapshot["finishedToday"] = [];
  const finishedRows = await db
    .select()
    .from(timeclocks)
    .where(
      and(
        eq(timeclocks.companyId, companyId),
        inArray(timeclocks.employeeId, employeeIds),
        sql`${timeclocks.exitTime} IS NOT NULL`,
        sql`${timeclocks.status} != 'voided'`,
        sql`${timeclocks.entryTime}::date = ${todayYmd}::date`
      )
    );
  const finishedByEmployee = new Map<number, (typeof finishedRows)[0]>();
  for (const row of finishedRows) {
    if (!clockedInIds.has(row.employeeId)) {
      finishedByEmployee.set(row.employeeId, row);
    }
  }
  for (const [employeeId, row] of finishedByEmployee) {
    finishedToday.push({
      employeeId,
      employeeName: nameById.get(employeeId) ?? "—",
      exitTime: row.exitTime ? new Date(row.exitTime).toISOString() : null,
    });
  }

  const notClockedIn = employees
    .filter((e) => !clockedInIds.has(e.id) && !onTimeOffIds.has(e.id) && !finishedByEmployee.has(e.id))
    .map((e) => ({ employeeId: e.id, employeeName: e.name }));

  return { working, onBreak, notClockedIn, onTimeOff, finishedToday };
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
