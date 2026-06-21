import { eq, and, desc, gte, lt, isNull } from "drizzle-orm";
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
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLocalAdminByCompany(companyId: number) {
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
}) {
  const db = await getDb();
  if (!db) return undefined;
  const openId = `local-admin-${params.companyId}`;
  await db.insert(users).values({
    companyId: params.companyId,
    openId,
    name: params.name,
    role: "admin",
    password: params.password,
    lastSignedIn: new Date(),
  });
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Employee queries
export async function getEmployeeById(id: number, companyId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(eq(employees.id, id), eq(employees.companyId, companyId))
    : eq(employees.id, id);
  const result = await db.select().from(employees).where(where).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getEmployeesByRestaurant(restaurantId: number, companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  const where = companyId
    ? and(eq(employees.restaurantId, restaurantId), eq(employees.companyId, companyId))
    : eq(employees.restaurantId, restaurantId);
  return await db.select().from(employees).where(where);
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
  const db = await getDb();
  if (!db) return undefined;
  const where = companyId
    ? and(eq(restaurants.id, id), eq(restaurants.companyId, companyId))
    : eq(restaurants.id, id);
  const result = await db.select().from(restaurants).where(where).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRestaurantByAdmin(adminId: number, companyId?: number) {
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
