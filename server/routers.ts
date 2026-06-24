import { COOKIE_NAME, EMPLOYEE_PRIVACY_NOTICE_VERSION } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  getRestaurantByAdmin, 
  getEmployeesByRestaurant, 
  getScheduleByEmployeeAndDay,
  getScheduleByEmployeeDayAndSlot,
  getTimeclocksByEmployee,
  getIncidentsByEmployee,
  getEmployeeById,
  getRestaurantById,
  getSchedulesByEmployee,
  getIncidentById,
  getEmployeeByUsername,
  getCompanyBySlug,
  getCompanyById,
  getLocalAdminByCompany,
  createLocalAdminForCompany,
  getTimeclockById,
  getTodayTimeclocksByEmployee,
  getLatestOpenTimeclockByEmployee,
  getLegalAcceptance,
  listAuditLogsByCompany,
  listEmployeePrivacyAcceptances,
  listTimeclocksForEmployeeIds,
  listIncidentsForEmployeeIds,
} from "./db";
import { getVapidPublicKey, sendPushNotification } from "./notificationService";
import { hashPassword } from "./_core/password";
import {
  parseScopedUsername,
  requireSuperAdminCredentials,
  resolveAdminAuth,
  resolveEmployeeAuth,
  resolveSuperAdminAuth,
  assertEmployeeBelongsToAdminCompany,
  normalizeCompanySlug,
} from "./_core/authResolve";
import { setSessionCookie, clearSessionCookie } from "./_core/session";
import { writeAuditLog } from "./_core/audit";
import {
  restaurants,
  employees,
  schedules,
  timeclocks,
  incidents,
  users,
  companies,
  pushSubscriptions,
  notificationLogs,
  timeOffRequests,
  legalAcceptances,
  auditLogs,
} from "../drizzle/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { format } from "date-fns";

const optionalCreds = z.object({
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Primer y último día del mes calendario (1–12) como `YYYY-MM-DD` en UTC. */
function calendarMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { start, end };
}

function addOneCalendarDayUtc(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + 86400000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function listDatesInclusive(start: string, end: string): string[] {
  if (end < start) return [];
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addOneCalendarDayUtc(cur);
  }
  return out;
}

/** Fecha calendario `YYYY-MM-DD` en una zona horaria (p. ej. Europa/Madrid para el negocio). */
function todayYmdInTimeZone(timeZone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.res, ctx.req);
      return { success: true } as const;
    }),
  }),

  publicApi: router({
    superAdminLogin: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireSuperAdminCredentials({
          username: input.username,
          password: input.password,
        });
        await setSessionCookie(ctx.res, ctx.req, { type: "superadmin" });
        return { success: true };
      }),

    superAdminListCompanies: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
      )
      .query(async ({ ctx, input }) => {
        requireSuperAdminCredentials({
          username: input.username,
          password: input.password,
        });
        const db = await getDb();
        if (!db) return [];
        const companyRows = await db.select().from(companies).orderBy(desc(companies.createdAt));
        const adminRows = await db
          .select()
          .from(users)
          .where(and(eq(users.role, "admin"), sql`${users.openId} LIKE 'local-admin-%'`));
        const adminByCompany = new Map(
          adminRows
            .filter((row) => row.companyId != null)
            .map((row) => [row.companyId as number, row])
        );
        return companyRows.map((company) => ({
          ...company,
          adminUsername: adminByCompany.get(company.id)?.name ?? null,
        }));
      }),

    superAdminCreateCompany: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
          companyName: z.string().min(2),
          companySlug: z.string().min(2),
          adminUsername: z.string().min(3),
          adminPassword: z.string().min(6),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireSuperAdminCredentials({
          username: input.username,
          password: input.password,
        });
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const slug = normalizeCompanySlug(input.companySlug);
        const existing = await getCompanyBySlug(slug);
        if (existing) {
          throw new Error("Ya existe una empresa con ese slug");
        }
        await db.insert(companies).values({
          name: input.companyName.trim(),
          slug,
          isActive: true,
        });
        const createdCompany = await getCompanyBySlug(slug);
        if (!createdCompany) {
          throw new Error("No se pudo crear la empresa");
        }
        const createdAdmin = await createLocalAdminForCompany({
          companyId: createdCompany.id,
          name: input.adminUsername.trim(),
          password: hashPassword(input.adminPassword),
        });
        if (!createdAdmin) {
          throw new Error("No se pudo crear el admin de empresa");
        }
        return { success: true, companyId: createdCompany.id, companySlug: createdCompany.slug };
      }),

    superAdminSetCompanyStatus: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
          companyId: z.number().int().positive(),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireSuperAdminCredentials({
          username: input.username,
          password: input.password,
        });
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, input.companyId))
          .limit(1);
        if (!company) throw new Error("Empresa no encontrada");
        await db
          .update(companies)
          .set({ isActive: input.isActive, updatedAt: new Date() })
          .where(eq(companies.id, input.companyId));
        return { success: true };
      }),

    superAdminSetCompanyAdmin: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
          companyId: z.number().int().positive(),
          adminUsername: z.string().min(3),
          adminPassword: z.string().min(6),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireSuperAdminCredentials({
          username: input.username,
          password: input.password,
        });
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, input.companyId))
          .limit(1);
        if (!company) throw new Error("Empresa no encontrada");
        const existingAdmin = await getLocalAdminByCompany(input.companyId);
        if (existingAdmin) {
          await db
            .update(users)
            .set({
              name: input.adminUsername.trim(),
              password: hashPassword(input.adminPassword),
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingAdmin.id));
          return { success: true };
        }
        const created = await createLocalAdminForCompany({
          companyId: input.companyId,
          name: input.adminUsername.trim(),
          password: hashPassword(input.adminPassword),
        });
        if (!created) {
          throw new Error("No se pudo crear el admin de empresa");
        }
        return { success: true };
      }),

    adminLogin: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    ).mutation(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      await setSessionCookie(ctx.res, ctx.req, {
        type: "admin",
        companyId: company.id,
        companySlug: company.slug,
        userId: admin.id,
        displayName: admin.name ?? undefined,
      });
      return { success: true, adminId: admin.id, companySlug: company.slug };
    }),

    getRestaurant: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
      })
    ).query(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      return (await getRestaurantByAdmin(admin.id, company.id)) ?? null;
    }),

    upsertRestaurant: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        name: z.string().min(1),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        radiusMeters: z.number().default(100),
      })
    ).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const existing = await getRestaurantByAdmin(admin.id, company.id);
      if (existing) {
        await db.update(restaurants).set({
          name: input.name,
          address: input.address,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          radiusMeters: input.radiusMeters,
        }).where(eq(restaurants.id, existing.id));
        return { success: true, restaurantId: existing.id };
      }
      await db.insert(restaurants).values({
        companyId: company.id,
        name: input.name,
        address: input.address,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
        radiusMeters: input.radiusMeters,
        adminId: admin.id,
      });
      const created = await getRestaurantByAdmin(admin.id, company.id);
      return { success: true, restaurantId: created?.id };
    }),

    createEmployee: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeName: z.string().min(1),
        employeeUsername: z.string().min(3),
        employeePassword: z.string().min(6),
        employeePhone: z.string().optional(),
        lateGraceMinutes: z.number().min(0).max(120).default(5),
        schedule: z.record(
          z.string(),
          z.union([
            z.string(),
            z.object({
              entry1: z.string().optional(),
              entry2: z.string().optional(),
              isActive: z.boolean(),
            }),
          ])
        ),
      })
    ).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) throw new Error("Restaurant not found");
      const result = await db.insert(employees).values({
        companyId: restaurant.companyId,
        restaurantId: restaurant.id,
        name: input.employeeName,
        username: input.employeeUsername,
        password: hashPassword(input.employeePassword),
        phone: input.employeePhone,
        lateGraceMinutes: input.lateGraceMinutes,
        isActive: true,
      });
      const employee = await getEmployeeByUsername(input.employeeUsername, restaurant.companyId);
      if (!employee) return { success: true };
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      for (const [dayKey, rawValue] of Object.entries(input.schedule)) {
        const value =
          typeof rawValue === "string"
            ? {
                entry1: rawValue,
                entry2: "",
                isActive: rawValue.trim().length > 0,
              }
            : rawValue;
        const dayOfWeek = dayMap[dayKey];
        if (dayOfWeek === undefined) continue;
        if (!value.isActive) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: employee.id,
            dayOfWeek,
            entryTime: "00:00",
            isWorkDay: false,
            entrySlot: 1,
          });
          continue;
        }
        if (value.entry1) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: employee.id,
            dayOfWeek,
            entryTime: value.entry1,
            isWorkDay: true,
            entrySlot: 1,
          });
        }
        if (value.entry2) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: employee.id,
            dayOfWeek,
            entryTime: value.entry2,
            isWorkDay: true,
            entrySlot: 2,
          });
        }
      }
      return { success: true };
    }),

    updateEmployee: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
        employeeName: z.string().min(1),
        employeeUsername: z.string().min(3),
        employeePassword: z.string().optional(),
        employeePhone: z.string().optional(),
        lateGraceMinutes: z.number().min(0).max(120).default(5),
        schedule: z.record(
          z.string(),
          z.union([
            z.string(),
            z.object({
              entry1: z.string().optional(),
              entry2: z.string().optional(),
              isActive: z.boolean(),
            }),
          ])
        ),
      })
    ).mutation(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) throw new Error("Negocio no encontrado");
      const employee = await assertEmployeeBelongsToAdminCompany(
        input.employeeId,
        company.id,
        restaurant.id
      );

      const updateData: Record<string, unknown> = {
        name: input.employeeName,
        username: input.employeeUsername,
        phone: input.employeePhone ?? null,
        lateGraceMinutes: input.lateGraceMinutes,
      };
      if (input.employeePassword) {
        updateData.password = hashPassword(input.employeePassword);
      }
      await db.update(employees).set(updateData).where(eq(employees.id, input.employeeId));

      await db.delete(schedules).where(eq(schedules.employeeId, input.employeeId));
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      for (const [dayKey, rawValue] of Object.entries(input.schedule)) {
        const value =
          typeof rawValue === "string"
            ? {
                entry1: rawValue,
                entry2: "",
                isActive: rawValue.trim().length > 0,
              }
            : rawValue;
        const dayOfWeek = dayMap[dayKey];
        if (dayOfWeek === undefined) continue;
        if (!value.isActive) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: "00:00",
            isWorkDay: false,
            entrySlot: 1,
          });
          continue;
        }
        if (value.entry1) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: value.entry1,
            isWorkDay: true,
            entrySlot: 1,
          });
        }
        if (value.entry2) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: value.entry2,
            isWorkDay: true,
            entrySlot: 2,
          });
        }
      }
      return { success: true };
    }),

    listEmployees: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
      })
    ).query(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) return [];
      return await getEmployeesByRestaurant(restaurant.id, company.id);
    }),

    getEmployeeRestaurant: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
      })
    ).query(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant) throw new Error("Restaurant not found");
      return restaurant;
    }),

    getTimeclocksByEmployee: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
      })
    ).query(async ({ ctx, input }) => {
      const { company } = await resolveAdminAuth(ctx, input);
      return await getTimeclocksByEmployee(input.employeeId, company.id);
    }),

    listIncidents: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
      })
    ).query(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) return [];
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
      const employeeIds = restaurantEmployees.map((e) => e.id);
      if (employeeIds.length === 0) return [];
      const db = await getDb();
      if (!db) return [];
      return listIncidentsForEmployeeIds(employeeIds, company.id);
    }),

    clearAllIncidents: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
      })
    ).mutation(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) throw new Error("Restaurant not found");
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
      const employeeIds = restaurantEmployees.map((employee) => employee.id);
      if (employeeIds.length === 0) return { success: true };

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(incidents).where(inArray(incidents.employeeId, employeeIds));

      return { success: true };
    }),

    listTimeclocks: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
      })
    ).query(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) return [];
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
      const employeeIds = restaurantEmployees.map((e) => e.id);
      if (employeeIds.length === 0) return [];
      const db = await getDb();
      if (!db) return [];
      return listTimeclocksForEmployeeIds(employeeIds, company.id);
    }),

    clearAllTimeclocks: publicProcedure.input(
      optionalCreds.extend({
        employeeId: z.number().optional(),
        rangeStart: z.string().optional(),
        rangeEnd: z.string().optional(),
        voidReason: z.string().min(10),
      })
    ).mutation(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) throw new Error("Negocio no encontrado");
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
      let employeeIds = restaurantEmployees.map((employee) => employee.id);
      if (input.employeeId) {
        employeeIds = employeeIds.filter((id) => id === input.employeeId);
      }
      if (employeeIds.length === 0) return { success: true, voided: 0 };

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const targetTimeclocks = await db
        .select()
        .from(timeclocks)
        .where(
          and(
            eq(timeclocks.companyId, company.id),
            inArray(timeclocks.employeeId, employeeIds),
            sql`${timeclocks.status} != 'voided'`
          )
        );

      const toVoid = targetTimeclocks.filter((item) => {
        const entryDate = new Date(item.entryTime || item.createdAt);
        if (input.rangeStart) {
          const start = new Date(input.rangeStart);
          start.setHours(0, 0, 0, 0);
          if (entryDate < start) return false;
        }
        if (input.rangeEnd) {
          const end = new Date(input.rangeEnd);
          end.setHours(23, 59, 59, 999);
          if (entryDate > end) return false;
        }
        return true;
      });
      if (toVoid.length === 0) return { success: true, voided: 0 };

      const now = new Date();
      for (const row of toVoid) {
        await db
          .update(timeclocks)
          .set({
            status: "voided",
            voidReason: input.voidReason.trim(),
            voidedByUserId: admin.id,
            voidedAt: now,
          })
          .where(eq(timeclocks.id, row.id));
        await writeAuditLog({
          companyId: company.id,
          entityType: "timeclock",
          entityId: row.id,
          action: "void_bulk",
          oldValue: row,
          newValue: { status: "voided", voidReason: input.voidReason },
          reason: input.voidReason,
          performedByType: "admin",
          performedById: admin.id,
        });
      }

      return { success: true, voided: toVoid.length };
    }),

    listNotificationLogs: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number().optional(),
      })
    ).query(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) return [];
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
      const employeeIds = restaurantEmployees.map((e) => e.id);
      if (employeeIds.length === 0) return [];
      if (input.employeeId && !employeeIds.includes(input.employeeId)) {
        return [];
      }
      const db = await getDb();
      if (!db) return [];
      const whereClause = input.employeeId
        ? and(
            eq(notificationLogs.employeeId, input.employeeId),
            inArray(notificationLogs.employeeId, employeeIds)
          )
        : inArray(notificationLogs.employeeId, employeeIds);
      return await db
        .select()
        .from(notificationLogs)
        .where(whereClause)
        .orderBy(desc(notificationLogs.notifiedAt))
        .limit(50);
    }),

    updateTimeclock: publicProcedure.input(
      optionalCreds.extend({
        timeclockId: z.number(),
        entryTime: z.string().optional().nullable(),
        exitTime: z.string().optional().nullable(),
        correctionReason: z.string().min(3),
      })
    ).mutation(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) throw new Error("Negocio no encontrado");
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
      const employeeIds = new Set(restaurantEmployees.map((employee) => employee.id));

      const timeclock = await getTimeclockById(input.timeclockId, company.id);
      if (!timeclock || !employeeIds.has(timeclock.employeeId) || timeclock.status === "voided") {
        throw new Error("Fichaje no encontrado");
      }

      const normalizeDate = (value: string | null | undefined) => {
        if (value === undefined) return undefined;
        if (value === null || value.trim() === "") return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error("Fecha inválida");
        }
        return parsed;
      };

      const entryTime = normalizeDate(input.entryTime);
      const exitTime = normalizeDate(input.exitTime);

      if (entryTime && exitTime && exitTime <= entryTime) {
        throw new Error("La salida debe ser posterior a la entrada");
      }

      const updateData: Record<string, unknown> = {
        status: "corrected",
        correctionReason: input.correctionReason.trim(),
        correctedByUserId: admin.id,
        correctedAt: new Date(),
      };
      if (entryTime !== undefined) updateData.entryTime = entryTime;
      if (exitTime !== undefined) updateData.exitTime = exitTime;
      if (entryTime === undefined && exitTime === undefined) {
        return { success: true };
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(timeclocks).set(updateData).where(eq(timeclocks.id, input.timeclockId));

      await writeAuditLog({
        companyId: company.id,
        entityType: "timeclock",
        entityId: input.timeclockId,
        action: "correct",
        oldValue: timeclock,
        newValue: { ...timeclock, ...updateData },
        reason: input.correctionReason,
        performedByType: "admin",
        performedById: admin.id,
      });

      return { success: true };
    }),

    voidTimeclock: publicProcedure.input(
      optionalCreds.extend({
        timeclockId: z.number(),
        voidReason: z.string().min(3),
      })
    ).mutation(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) throw new Error("Negocio no encontrado");
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
      const employeeIds = new Set(restaurantEmployees.map((employee) => employee.id));

      const timeclock = await getTimeclockById(input.timeclockId, company.id);
      if (!timeclock || !employeeIds.has(timeclock.employeeId) || timeclock.status === "voided") {
        throw new Error("Fichaje no encontrado");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const now = new Date();
      await db
        .update(timeclocks)
        .set({
          status: "voided",
          voidReason: input.voidReason.trim(),
          voidedByUserId: admin.id,
          voidedAt: now,
        })
        .where(eq(timeclocks.id, input.timeclockId));

      await writeAuditLog({
        companyId: company.id,
        entityType: "timeclock",
        entityId: input.timeclockId,
        action: "void",
        oldValue: timeclock,
        newValue: { status: "voided", voidReason: input.voidReason },
        reason: input.voidReason,
        performedByType: "admin",
        performedById: admin.id,
      });

      return { success: true };
    }),

    /** @deprecated Usar voidTimeclock — mantiene compatibilidad sin borrado físico. */
    deleteTimeclock: publicProcedure.input(
      optionalCreds.extend({
        timeclockId: z.number(),
        voidReason: z.string().min(3).optional(),
      })
    ).mutation(async ({ ctx, input }) => {
      const reason = input.voidReason ?? "Anulación desde panel admin (legacy)";
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) throw new Error("Negocio no encontrado");
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
      const employeeIds = new Set(restaurantEmployees.map((employee) => employee.id));

      const timeclock = await getTimeclockById(input.timeclockId, company.id);
      if (!timeclock || !employeeIds.has(timeclock.employeeId) || timeclock.status === "voided") {
        throw new Error("Fichaje no encontrado");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(timeclocks)
        .set({
          status: "voided",
          voidReason: reason,
          voidedByUserId: admin.id,
          voidedAt: new Date(),
        })
        .where(eq(timeclocks.id, input.timeclockId));

      await writeAuditLog({
        companyId: company.id,
        entityType: "timeclock",
        entityId: input.timeclockId,
        action: "void",
        oldValue: timeclock,
        newValue: { status: "voided", voidReason: reason },
        reason,
        performedByType: "admin",
        performedById: admin.id,
      });

      return { success: true };
    }),

    getEmployeeTimeclocks: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
      })
    ).query(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      return await getTimeclocksByEmployee(input.employeeId, employee.companyId);
    }),

    getEmployeeSchedule: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
      })
    ).query(async ({ ctx, input }) => {
      let companyId: number;
      let targetEmployeeId = input.employeeId;
      try {
        const { company } = await resolveAdminAuth(ctx, input);
        companyId = company.id;
      } catch {
        const employee = await resolveEmployeeAuth(ctx, input);
        companyId = employee.companyId;
        targetEmployeeId = employee.id;
      }

      const scheduleRows = await getSchedulesByEmployee(targetEmployeeId, companyId);
      const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const scheduleMap: Record<string, { entry1: string; entry2: string; isActive: boolean }> = {};
      for (const row of scheduleRows) {
        const key = dayKeys[row.dayOfWeek] ?? "monday";
        if (!scheduleMap[key]) {
          scheduleMap[key] = { entry1: "", entry2: "", isActive: row.isWorkDay };
        }
        if (!row.isWorkDay) {
          scheduleMap[key].isActive = false;
        } else if (row.entrySlot === 2) {
          scheduleMap[key].entry2 = row.entryTime;
        } else {
          scheduleMap[key].entry1 = row.entryTime;
        }
      }
      return scheduleMap;
    }),

    updateEmployeeSchedule: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
        schedule: z.record(
          z.string(),
          z.union([
            z.string(),
            z.object({
              entry1: z.string().optional(),
              entry2: z.string().optional(),
              isActive: z.boolean(),
            }),
          ])
        ),
      })
    ).mutation(async ({ ctx, input }) => {
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      if (!restaurant) throw new Error("Negocio no encontrado");
      const employee = await assertEmployeeBelongsToAdminCompany(
        input.employeeId,
        company.id,
        restaurant.id
      );

      await db.delete(schedules).where(eq(schedules.employeeId, input.employeeId));
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      for (const [dayKey, rawValue] of Object.entries(input.schedule)) {
        const value =
          typeof rawValue === "string"
            ? {
                entry1: rawValue,
                entry2: "",
                isActive: rawValue.trim().length > 0,
              }
            : rawValue;
        const dayOfWeek = dayMap[dayKey];
        if (dayOfWeek === undefined) continue;

        if (!value.isActive) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: "00:00",
            isWorkDay: false,
            entrySlot: 1,
          });
          continue;
        }
        if (value.entry1) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: value.entry1,
            isWorkDay: true,
            entrySlot: 1,
          });
        }
        if (value.entry2) {
          await db.insert(schedules).values({
            companyId: employee.companyId,
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: value.entry2,
            isWorkDay: true,
            entrySlot: 2,
          });
        }
      }

      return { success: true };
    }),

    employeeLogin: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    ).mutation(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      const scheduleRows = await getSchedulesByEmployee(employee.id, employee.companyId);
      const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const scheduleMap: Record<string, { entry1: string; entry2: string; isActive: boolean }> = {};
      for (const row of scheduleRows) {
        const key = dayKeys[row.dayOfWeek] ?? "monday";
        if (!scheduleMap[key]) {
          scheduleMap[key] = { entry1: "", entry2: "", isActive: row.isWorkDay };
        }
        if (!row.isWorkDay) {
          scheduleMap[key].isActive = false;
        } else if (row.entrySlot === 2) {
          scheduleMap[key].entry2 = row.entryTime;
        } else {
          scheduleMap[key].entry1 = row.entryTime;
        }
      }
      const company = await getCompanyById(employee.companyId);
      const acceptance = await getLegalAcceptance(
        employee.id,
        "employee_privacy_notice",
        EMPLOYEE_PRIVACY_NOTICE_VERSION
      );
      await setSessionCookie(ctx.res, ctx.req, {
        type: "employee",
        companyId: employee.companyId,
        companySlug: company?.slug,
        employeeId: employee.id,
        displayName: employee.name,
      });
      return {
        success: true,
        employeeId: employee.id,
        restaurantId: employee.restaurantId,
        companySlug: company?.slug ?? "default",
        schedule: scheduleMap,
        lateGraceMinutes: employee.lateGraceMinutes ?? 5,
        locationEnabled: company?.locationEnabled ?? false,
        needsPrivacyNotice: !acceptance,
        privacyNoticeVersion: EMPLOYEE_PRIVACY_NOTICE_VERSION,
      };
    }),

    clockIn: publicProcedure.input(
      optionalCreds.extend({
        employeeId: z.number(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    ).mutation(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const company = await getCompanyById(employee.companyId);
      const restaurant = await getRestaurantById(employee.restaurantId, employee.companyId);
      if (!restaurant) throw new Error("Negocio no encontrado");

      if (company?.locationEnabled) {
        if (input.latitude === undefined || input.longitude === undefined) {
          throw new Error("Se requiere ubicación para fichar en este negocio");
        }
        const distance = calculateDistance(
          parseFloat(restaurant.latitude.toString()),
          parseFloat(restaurant.longitude.toString()),
          input.latitude,
          input.longitude
        );
        if (distance > restaurant.radiusMeters) {
          throw new Error("No estás en la ubicación autorizada del negocio");
        }
      }
      const openRecord = await getLatestOpenTimeclockByEmployee(input.employeeId);
      if (openRecord) throw new Error("You must clock out before clocking in again");
      const now = new Date();
      let isLate = false;
      const graceMinutes = employee.lateGraceMinutes ?? 5;
      const dayOfWeek = now.getDay();
      const todayTimeclocks = await getTodayTimeclocksByEmployee(input.employeeId, now);
      const completedShifts = todayTimeclocks.filter(tc => tc.exitTime).length;
      const schedule =
        completedShifts === 0
          ? await getScheduleByEmployeeAndDay(input.employeeId, dayOfWeek)
          : completedShifts === 1
          ? await getScheduleByEmployeeDayAndSlot(input.employeeId, dayOfWeek, 2)
          : undefined;
      if (schedule && schedule.isWorkDay && schedule.entryTime !== "00:00") {
        const parsed = parseScheduleTime(schedule.entryTime);
        if (parsed) {
          const scheduleTime = new Date();
          scheduleTime.setHours(parsed.hour, parsed.minute, 0, 0);
          const graceTime = new Date(scheduleTime.getTime() + graceMinutes * 60 * 1000);
          if (now > graceTime) {
            isLate = true;
          }
        }
      }
      await db.insert(timeclocks).values({
        companyId: employee.companyId,
        employeeId: input.employeeId,
        entryTime: now,
        isLate,
        status: "valid",
        source: "mobile",
        latitude:
          input.latitude !== undefined ? input.latitude.toString() : null,
        longitude:
          input.longitude !== undefined ? input.longitude.toString() : null,
      });
      return { success: true, isLate };
    }),

    clockOut: publicProcedure.input(
      optionalCreds.extend({
        employeeId: z.number(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    ).mutation(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const company = await getCompanyById(employee.companyId);
      const restaurant = await getRestaurantById(employee.restaurantId, employee.companyId);
      if (!restaurant) throw new Error("Negocio no encontrado");

      if (company?.locationEnabled) {
        if (input.latitude === undefined || input.longitude === undefined) {
          throw new Error("Se requiere ubicación para fichar en este negocio");
        }
        const distance = calculateDistance(
          parseFloat(restaurant.latitude.toString()),
          parseFloat(restaurant.longitude.toString()),
          input.latitude,
          input.longitude
        );
        if (distance > restaurant.radiusMeters) {
          throw new Error("No estás en la ubicación autorizada del negocio");
        }
      }
      const openRecord = await getLatestOpenTimeclockByEmployee(input.employeeId, employee.companyId);
      if (!openRecord) throw new Error("No hay fichaje de entrada activo");
      const now = new Date();
      await db.update(timeclocks).set({
        exitTime: now,
        exitLatitude:
          input.latitude !== undefined ? input.latitude.toString() : null,
        exitLongitude:
          input.longitude !== undefined ? input.longitude.toString() : null,
      }).where(eq(timeclocks.id, openRecord.id));
      return { success: true };
    }),

    createIncident: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
        type: z.enum(["late_arrival", "early_exit", "other"]),
        reason: z.string().min(1),
        timeclockId: z.number().optional(),
      })
    ).mutation(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(incidents).values({
        companyId: employee.companyId,
        employeeId: input.employeeId,
        timeclockId: input.timeclockId,
        type: input.type,
        reason: input.reason,
        status: "pending",
      });
      return { success: true };
    }),

    createTimeOffRequest: publicProcedure
      .input(
        optionalCreds.extend({
          employeeId: z.number(),
          kind: z.enum(["vacation", "day_off"]),
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          comment: z.string().min(1).max(2000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const employee = await resolveEmployeeAuth(ctx, input);
        if (input.endDate < input.startDate) {
          throw new Error("La fecha fin debe ser igual o posterior a la de inicio");
        }
        const todayStr = todayYmdInTimeZone("Europe/Madrid");
        if (input.startDate < todayStr) {
          throw new Error("La solicitud debe ser para hoy o fechas futuras");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        // `select({ ... })` parcial provocaba fallos en postgres.js; mismo patrón que listMyTimeOffRequests.
        const existingRequests = await db
          .select()
          .from(timeOffRequests)
          .where(eq(timeOffRequests.employeeId, input.employeeId));

        const hasConflict = existingRequests.some((row) => {
          if (row.status !== "pending" && row.status !== "approved") return false;
          const rowStart =
            typeof row.startDate === "string"
              ? row.startDate
              : format(row.startDate as Date, "yyyy-MM-dd");
          const rowEnd =
            typeof row.endDate === "string"
              ? row.endDate
              : format(row.endDate as Date, "yyyy-MM-dd");
          return rowStart <= input.endDate && rowEnd >= input.startDate;
        });

        if (hasConflict) {
          throw new Error(
            "Las fechas se solapan con otra solicitud tuya pendiente o ya aprobada. Elige otros días."
          );
        }
        try {
          await db.insert(timeOffRequests).values({
            companyId: employee.companyId,
            employeeId: input.employeeId,
            kind: input.kind,
            startDate: input.startDate,
            endDate: input.endDate,
            comment: input.comment.trim(),
            status: "pending",
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("time_off_requests") ||
            msg.includes("does not exist") ||
            msg.includes("relation") ||
            msg.includes("42P01")
          ) {
            throw new Error(
              "La base de datos no tiene aún la tabla de solicitudes. Aplica la migración 0004_time_off_requests en el servidor (PostgreSQL)."
            );
          }
          throw err;
        }
        return { success: true };
      }),

    deleteMyTimeOffRequest: publicProcedure
      .input(
        optionalCreds.extend({
          employeeId: z.number(),
          requestId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await resolveEmployeeAuth(ctx, input);
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [row] = await db
          .select()
          .from(timeOffRequests)
          .where(eq(timeOffRequests.id, input.requestId))
          .limit(1);
        if (!row || row.employeeId !== input.employeeId) {
          throw new Error("Solicitud no encontrada");
        }
        if (row.status !== "pending" && row.status !== "approved") {
          throw new Error("Solo puedes anular solicitudes pendientes o ya aprobadas");
        }
        await db.delete(timeOffRequests).where(eq(timeOffRequests.id, input.requestId));
        return { success: true };
      }),

    adminDeleteTimeOffRequest: publicProcedure
      .input(optionalCreds.extend({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        const restaurant = await getRestaurantByAdmin(admin.id, company.id);
        if (!restaurant) throw new Error("Restaurant not found");
        const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
        const employeeIds = new Set(restaurantEmployees.map((e) => e.id));
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [row] = await db
          .select()
          .from(timeOffRequests)
          .where(eq(timeOffRequests.id, input.requestId))
          .limit(1);
        if (!row) throw new Error("Solicitud no encontrada");
        if (!employeeIds.has(row.employeeId)) throw new Error("No autorizado");
        if (row.status !== "pending" && row.status !== "approved") {
          throw new Error("Solo se pueden anular solicitudes pendientes o aprobadas");
        }
        await db.delete(timeOffRequests).where(eq(timeOffRequests.id, input.requestId));
        return { success: true };
      }),

    listMyTimeOffRequests: publicProcedure
      .input(optionalCreds.extend({ employeeId: z.number() }))
      .query(async ({ ctx, input }) => {
        const employee = await resolveEmployeeAuth(ctx, input);
        const db = await getDb();
        if (!db) return [];
        return await db
          .select()
          .from(timeOffRequests)
          .where(
            and(
              eq(timeOffRequests.employeeId, input.employeeId),
              eq(timeOffRequests.companyId, employee.companyId)
            )
          )
          .orderBy(desc(timeOffRequests.createdAt));
      }),

    listTimeOffRequests: publicProcedure
      .input(
        optionalCreds.extend({
          status: z.enum(["pending", "approved", "rejected", "all"]).optional().default("all"),
        })
      )
      .query(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        const restaurant = await getRestaurantByAdmin(admin.id, company.id);
        if (!restaurant) return [];
        const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
        const employeeIds = restaurantEmployees.map((e) => e.id);
        if (employeeIds.length === 0) return [];
        const db = await getDb();
        if (!db) return [];
        const nameById = new Map(restaurantEmployees.map((e) => [e.id, e.name]));
        const rows = await db
          .select()
          .from(timeOffRequests)
          .where(
            and(
              inArray(timeOffRequests.employeeId, employeeIds),
              eq(timeOffRequests.companyId, company.id)
            )
          )
          .orderBy(desc(timeOffRequests.createdAt));
        const filtered =
          input.status === "all" ? rows : rows.filter((r) => r.status === input.status);
        return filtered.map((r) => ({
          ...r,
          employeeName: nameById.get(r.employeeId) ?? "—",
        }));
      }),

    decideTimeOffRequest: publicProcedure
      .input(
        optionalCreds.extend({
          requestId: z.number(),
          decision: z.enum(["approved", "rejected"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        const restaurant = await getRestaurantByAdmin(admin.id, company.id);
        if (!restaurant) throw new Error("Restaurant not found");
        const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
        const employeeIds = new Set(restaurantEmployees.map((e) => e.id));
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [row] = await db
          .select()
          .from(timeOffRequests)
          .where(
            and(eq(timeOffRequests.id, input.requestId), eq(timeOffRequests.companyId, company.id))
          )
          .limit(1);
        if (!row) throw new Error("Solicitud no encontrada");
        if (!employeeIds.has(row.employeeId)) throw new Error("No autorizado");
        if (row.status !== "pending") {
          throw new Error("Esta solicitud ya fue revisada");
        }
        await db
          .update(timeOffRequests)
          .set({
            status: input.decision,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(timeOffRequests.id, input.requestId));
        return { success: true };
      }),

    getTimeOffCalendarMonth: publicProcedure
      .input(
        optionalCreds.extend({
          year: z.number().int().min(2020).max(2100),
          month: z.number().int().min(1).max(12),
        })
      )
      .query(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        const restaurant = await getRestaurantByAdmin(admin.id, company.id);
        if (!restaurant) {
          return {
            days: [] as {
              date: string;
              entries: { employeeName: string; kind: string; status: string; requestId: number }[];
            }[],
          };
        }
        const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
        const employeeIds = restaurantEmployees.map((e) => e.id);
        if (employeeIds.length === 0) return { days: [] };
        const nameById = new Map(restaurantEmployees.map((e) => [e.id, e.name]));
        const db = await getDb();
        if (!db) return { days: [] };
        const { start: rangeStartStr, end: rangeEndStr } = calendarMonthRange(input.year, input.month);
        const rows = await db
          .select()
          .from(timeOffRequests)
          .where(
            and(
              inArray(timeOffRequests.employeeId, employeeIds),
              eq(timeOffRequests.companyId, company.id),
              sql`${timeOffRequests.startDate}::text <= ${rangeEndStr}`,
              sql`${timeOffRequests.endDate}::text >= ${rangeStartStr}`
            )
          );
        const dayMap = new Map<
          string,
          { employeeName: string; kind: string; status: string; requestId: number }[]
        >();
        for (const r of rows) {
          const startStr =
            typeof r.startDate === "string"
              ? r.startDate
              : format(r.startDate as Date, "yyyy-MM-dd");
          const endStr =
            typeof r.endDate === "string" ? r.endDate : format(r.endDate as Date, "yyyy-MM-dd");
          const sliceStart = startStr > rangeStartStr ? startStr : rangeStartStr;
          const sliceEnd = endStr < rangeEndStr ? endStr : rangeEndStr;
          for (const key of listDatesInclusive(sliceStart, sliceEnd)) {
            const list = dayMap.get(key) ?? [];
            list.push({
              employeeName: nameById.get(r.employeeId) ?? "—",
              kind: r.kind,
              status: r.status,
              requestId: r.id,
            });
            dayMap.set(key, list);
          }
        }
        const days = Array.from(dayMap.entries())
          .map(([date, entries]) => ({ date, entries }))
          .sort((a, b) => a.date.localeCompare(b.date));
        return { days };
      }),

    pushNotifications: router({
      getVapidPublicKey: publicProcedure.query(() => {
        return { publicKey: getVapidPublicKey() };
      }),

      subscribe: publicProcedure.input(
        optionalCreds.extend({
          employeeId: z.number(),
          subscription: z.object({
            endpoint: z.string().url(),
            keys: z.object({
              p256dh: z.string(),
              auth: z.string(),
            }),
          }),
        })
      ).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const employee = await resolveEmployeeAuth(ctx, input);

        const existing = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.subscription.endpoint))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(pushSubscriptions)
            .set({
              companyId: employee.companyId,
              employeeId: input.employeeId,
              p256dh: input.subscription.keys.p256dh,
              auth: input.subscription.keys.auth,
              updatedAt: new Date(),
            })
            .where(eq(pushSubscriptions.endpoint, input.subscription.endpoint));
        } else {
          await db.insert(pushSubscriptions).values({
            companyId: employee.companyId,
            employeeId: input.employeeId,
            endpoint: input.subscription.endpoint,
            p256dh: input.subscription.keys.p256dh,
            auth: input.subscription.keys.auth,
          });
        }

        return { success: true };
      }),

      unsubscribe: publicProcedure.input(
        z.object({
          endpoint: z.string().url(),
        })
      ).mutation(async ({ ctx, input }) => {
        if (ctx.session?.type !== "employee" || !ctx.session.employeeId) {
          throw new Error("No autorizado");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const [sub] = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.endpoint))
          .limit(1);
        if (!sub || sub.employeeId !== ctx.session.employeeId) {
          throw new Error("Suscripción no encontrada");
        }

        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.endpoint));

        return { success: true };
      }),
    }),

    sendTestNotification: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
      })
    ).mutation(async ({ ctx, input }) => {
      const { company } = await resolveAdminAuth(ctx, input);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!getVapidPublicKey()) {
        throw new Error("Push notifications are not configured");
      }

      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.employeeId, input.employeeId),
            eq(pushSubscriptions.companyId, company.id)
          )
        );

      if (subscriptions.length === 0) {
        throw new Error("No hay dispositivos suscritos para este empleado");
      }

      let successCount = 0;
      let failCount = 0;
      for (const sub of subscriptions) {
        try {
          await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            "🔔 Notificación de prueba",
            "Esta es una notificación de prueba de TimeClock.",
            { url: "/employee/dashboard" }
          );
          successCount += 1;
        } catch (error) {
          console.error("Test notification failed:", error);
          failCount += 1;
        }
      }

      if (successCount === 0) {
        throw new Error("No se pudo enviar ninguna notificación");
      }

      return { success: true, sent: successCount, failed: failCount };
    }),

    getSession: publicProcedure.query(async ({ ctx }) => ({
      session: ctx.session,
    })),

    logoutSession: publicProcedure.mutation(async ({ ctx }) => {
      clearSessionCookie(ctx.res, ctx.req);
      return { success: true };
    }),

    getCompanyLegal: publicProcedure.input(optionalCreds).query(async ({ ctx, input }) => {
      const { company } = await resolveAdminAuth(ctx, input);
      return company;
    }),

    listEmployeePrivacyAcceptances: publicProcedure
      .input(optionalCreds)
      .query(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        const restaurant = await getRestaurantByAdmin(admin.id, company.id);
        if (!restaurant) return [];
        return listEmployeePrivacyAcceptances(
          company.id,
          restaurant.id,
          EMPLOYEE_PRIVACY_NOTICE_VERSION
        );
      }),

    updateCompanyLegal: publicProcedure
      .input(
        optionalCreds.extend({
          legalName: z.string().optional(),
          taxId: z.string().optional(),
          address: z.string().optional(),
          privacyContactEmail: z.string().email().optional().or(z.literal("")),
          country: z.string().length(2).optional(),
          timezone: z.string().optional(),
          locationEnabled: z.boolean().optional(),
          dataRetentionYears: z.number().min(4).max(10).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { company, admin } = await resolveAdminAuth(ctx, input);
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const update: Record<string, unknown> = { updatedAt: new Date() };
        if (input.legalName !== undefined) update.legalName = input.legalName.trim() || null;
        if (input.taxId !== undefined) update.taxId = input.taxId.trim() || null;
        if (input.address !== undefined) update.address = input.address.trim() || null;
        if (input.privacyContactEmail !== undefined) {
          update.privacyContactEmail = input.privacyContactEmail.trim() || null;
        }
        if (input.country !== undefined) update.country = input.country;
        if (input.timezone !== undefined) update.timezone = input.timezone;
        if (input.locationEnabled !== undefined) update.locationEnabled = input.locationEnabled;
        if (input.dataRetentionYears !== undefined) {
          update.dataRetentionYears = input.dataRetentionYears;
        }
        await db.update(companies).set(update).where(eq(companies.id, company.id));
        await writeAuditLog({
          companyId: company.id,
          entityType: "company",
          entityId: company.id,
          action: "update_legal",
          newValue: update,
          performedByType: "admin",
          performedById: admin.id,
        });
        return { success: true };
      }),

    getPublicCompanyLegal: publicProcedure
      .input(z.object({ companySlug: z.string().min(1) }))
      .query(async ({ input }) => {
        const company = await getCompanyBySlug(input.companySlug);
        if (!company) return null;
        return {
          name: company.name,
          slug: company.slug,
          legalName: company.legalName,
          taxId: company.taxId,
          address: company.address,
          privacyContactEmail: company.privacyContactEmail,
          country: company.country,
          timezone: company.timezone,
          locationEnabled: company.locationEnabled,
          dataRetentionYears: company.dataRetentionYears,
        };
      }),

    acceptEmployeePrivacyNotice: publicProcedure
      .input(
        optionalCreds.extend({
          documentVersion: z.string().default(EMPLOYEE_PRIVACY_NOTICE_VERSION),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const employee = await resolveEmployeeAuth(ctx, input);
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await getLegalAcceptance(
          employee.id,
          "employee_privacy_notice",
          input.documentVersion
        );
        if (existing) return { success: true, alreadyAccepted: true };
        const ip =
          (ctx.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
          ctx.req.socket.remoteAddress ??
          null;
        await db.insert(legalAcceptances).values({
          companyId: employee.companyId,
          employeeId: employee.id,
          documentType: "employee_privacy_notice",
          documentVersion: input.documentVersion,
          ipAddress: ip,
        });
        return { success: true, alreadyAccepted: false };
      }),

    listAuditLogs: publicProcedure
      .input(optionalCreds.extend({ limit: z.number().min(1).max(500).optional() }))
      .query(async ({ ctx, input }) => {
        const { company } = await resolveAdminAuth(ctx, input);
        return listAuditLogsByCompany(company.id, input.limit ?? 100);
      }),

    deactivateEmployee: publicProcedure
      .input(
        optionalCreds.extend({
          employeeId: z.number(),
          reason: z.string().min(3).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        const restaurant = await getRestaurantByAdmin(admin.id, company.id);
        if (!restaurant) throw new Error("Negocio no encontrado");
        const employee = await assertEmployeeBelongsToAdminCompany(
          input.employeeId,
          company.id,
          restaurant.id
        );
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db
          .update(employees)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(employees.id, employee.id));
        await writeAuditLog({
          companyId: company.id,
          entityType: "employee",
          entityId: employee.id,
          action: "deactivate",
          oldValue: { isActive: true },
          newValue: { isActive: false },
          reason: input.reason,
          performedByType: "admin",
          performedById: admin.id,
        });
        return { success: true };
      }),
  }),

  // Restaurant management
  restaurant: router({
    getByAdmin: adminProcedure.query(async ({ ctx }) => {
      return await getRestaurantByAdmin(ctx.user.id);
    }),
    
    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      address: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      radiusMeters: z.number().default(100),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const result = await db.insert(restaurants).values({
        companyId: ctx.user.companyId ?? 1,
        name: input.name,
        address: input.address,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
        radiusMeters: input.radiusMeters,
        adminId: ctx.user.id,
      });
      
      return { success: true };
    }),

    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      radiusMeters: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const restaurant = await getRestaurantById(input.id);
      if (!restaurant || restaurant.adminId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }
      
      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.address) updateData.address = input.address;
      if (input.latitude) updateData.latitude = input.latitude.toString();
      if (input.longitude) updateData.longitude = input.longitude.toString();
      if (input.radiusMeters) updateData.radiusMeters = input.radiusMeters;
      
      await db.update(restaurants).set(updateData).where(eq(restaurants.id, input.id));
      return { success: true };
    }),
  }),

  // Employee management
  employee: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const restaurant = await getRestaurantByAdmin(ctx.user.id);
      if (!restaurant) return [];
      return await getEmployeesByRestaurant(restaurant.id);
    }),

    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      username: z.string().min(3),
      password: z.string().min(6),
      phone: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const restaurant = await getRestaurantByAdmin(ctx.user.id);
      if (!restaurant) throw new Error('Restaurant not found');
      
      const result = await db.insert(employees).values({
        companyId: restaurant.companyId,
        restaurantId: restaurant.id,
        name: input.name,
        username: input.username,
        password: hashPassword(input.password),
        phone: input.phone,
        isActive: true,
      });
      
      return { success: true };
    }),

    getById: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      return await getEmployeeById(input);
    }),
  }),

  // Schedule management
  schedule: router({
    getByEmployee: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      return await getSchedulesByEmployee(input);
    }),

    create: adminProcedure.input(z.object({
      employeeId: z.number(),
      dayOfWeek: z.number().min(0).max(6),
      entryTime: z.string(),
      exitTime: z.string().optional(),
      isWorkDay: z.boolean().default(true),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const employee = await getEmployeeById(input.employeeId);
      if (!employee) throw new Error('Employee not found');
      
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant || restaurant.adminId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }
      
      await db.insert(schedules).values({
        companyId: employee.companyId,
        employeeId: input.employeeId,
        dayOfWeek: input.dayOfWeek,
        entryTime: input.entryTime,
        exitTime: input.exitTime,
        isWorkDay: input.isWorkDay,
      });
      
      return { success: true };
    }),
  }),

  // Timeclock management
  timeclock: router({
    getByEmployee: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      return await getTimeclocksByEmployee(input);
    }),

    clockIn: protectedProcedure.input(z.object({
      employeeId: z.number(),
      latitude: z.number(),
      longitude: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const employee = await getEmployeeById(input.employeeId);
      if (!employee) throw new Error('Employee not found');
      
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant) throw new Error('Restaurant not found');
      
      // Validate location
      const distance = calculateDistance(
        parseFloat(restaurant.latitude.toString()),
        parseFloat(restaurant.longitude.toString()),
        input.latitude,
        input.longitude
      );
      
      if (distance > restaurant.radiusMeters) {
        throw new Error('You are not at the restaurant location');
      }
      
      // Check if there is any active open record
      const openRecord = await getLatestOpenTimeclockByEmployee(input.employeeId);
      if (openRecord) {
        throw new Error('You must clock out before clocking in again');
      }
      
      // Check if late
      const now = new Date();
      const dayOfWeek = now.getDay();
      const todayTimeclocks = await getTodayTimeclocksByEmployee(input.employeeId, now);
      const completedShifts = todayTimeclocks.filter(tc => tc.exitTime).length;
      const schedule =
        completedShifts === 0
          ? await getScheduleByEmployeeAndDay(input.employeeId, dayOfWeek)
          : completedShifts === 1
          ? await getScheduleByEmployeeDayAndSlot(input.employeeId, dayOfWeek, 2)
          : undefined;
      
      let isLate = false;
      const graceMinutes = employee.lateGraceMinutes ?? 5;
      if (schedule) {
        const parsed = parseScheduleTime(schedule.entryTime);
        if (parsed) {
          const scheduleTime = new Date();
          scheduleTime.setHours(parsed.hour, parsed.minute, 0, 0);
          const graceTime = new Date(scheduleTime.getTime() + graceMinutes * 60 * 1000);
          
          if (now > graceTime) {
            isLate = true;
          }
        }
      }
      
      await db.insert(timeclocks).values({
        companyId: employee.companyId,
        employeeId: input.employeeId,
        entryTime: now,
        isLate,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
      });
      
      return { success: true, isLate };
    }),

    clockOut: protectedProcedure.input(z.object({
      employeeId: z.number(),
      latitude: z.number(),
      longitude: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const employee = await getEmployeeById(input.employeeId);
      if (!employee) throw new Error('Employee not found');
      
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant) throw new Error('Restaurant not found');
      
      // Validate location
      const distance = calculateDistance(
        parseFloat(restaurant.latitude.toString()),
        parseFloat(restaurant.longitude.toString()),
        input.latitude,
        input.longitude
      );
      
      if (distance > restaurant.radiusMeters) {
        throw new Error('You are not at the restaurant location');
      }
      
      // Get latest active timeclock entry
      const todayRecord = await getLatestOpenTimeclockByEmployee(input.employeeId);
      
      if (!todayRecord) {
        throw new Error('No active timeclock entry found');
      }
      
      const now = new Date();
      await db.update(timeclocks).set({
        exitTime: now,
      }).where(eq(timeclocks.id, todayRecord.id));
      
      return { success: true };
    }),
  }),

  // Incident management
  incident: router({
    getByEmployee: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      return await getIncidentsByEmployee(input);
    }),

    create: protectedProcedure.input(z.object({
      employeeId: z.number(),
      timeclockId: z.number().optional(),
      type: z.enum(['late_arrival', 'early_exit', 'other']),
      reason: z.string().min(1),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      await db.insert(incidents).values({
        companyId: ctx.user.companyId ?? 1,
        employeeId: input.employeeId,
        timeclockId: input.timeclockId,
        type: input.type,
        reason: input.reason,
        status: 'pending',
      });
      
      return { success: true };
    }),

    list: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      
      const restaurant = await getRestaurantByAdmin(ctx.user.id);
      if (!restaurant) return [];
      
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id);
      const employeeIds = restaurantEmployees.map(e => e.id);
      
      if (employeeIds.length === 0) return [];
      
      const allIncidents = await db.select().from(incidents);
      return allIncidents.filter(inc => employeeIds.includes(inc.employeeId));
    }),

    updateStatus: adminProcedure.input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'approved', 'rejected']),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const incident = await getIncidentById(input.id);
      if (!incident) throw new Error('Incident not found');
      
      await db.update(incidents).set({
        status: input.status,
      }).where(eq(incidents.id, input.id));
      
      return { success: true };
    }),
  }),

});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseScheduleTime(entryTime: string): { hour: number; minute: number } | null {
  const trimmed = entryTime.replace(".", ":").trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [hourStr, minuteStr] = trimmed.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr || "0");
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { hour, minute };
  }
  const hour = Number(trimmed);
  if (Number.isNaN(hour)) return null;
  return { hour, minute: 0 };
}

export type AppRouter = typeof appRouter;
