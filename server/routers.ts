import { COOKIE_NAME, EMPLOYEE_PRIVACY_NOTICE_VERSION, DUPLICATE_EMPLOYEE_EMAIL_MSG, EARLY_CLOCK_MINUTES } from "@shared/const";
import {
  formatScheduleTime,
  getClockWindowMinutes,
  parseScheduleEntryTime,
} from "@shared/scheduleClockWindow";
import {
  getDayOfWeekInTimeZone,
  getMinutesSinceMidnightInTimeZone,
  todayYmdInTimeZone,
} from "@shared/timezone";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, deprecatedProcedure } from "./_core/trpc";
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
  getEmployeeByEmail,
  normalizeEmployeeEmail,
  getCompanyBySlug,
  getCompanyById,
  getLocalAdminByCompany,
  createLocalAdminForCompany,
  getTimeclockById,
  getTodayTimeclocksByEmployee,
  getLatestOpenTimeclockByEmployee,
  getEmployeeClockPauseState,
  getOpenBreakForTimeclock,
  closeOpenBreakForTimeclock,
  getLegalAcceptance,
  listEmployeePrivacyAcceptances,
  listTimeclocksForEmployeeIds,
  listIncidentsForEmployeeIds,
  registerBusinessTenant,
  countEmployeesByCompany,
  getAdminWorkforceToday,
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
import { checkRateLimit, checkRateLimitWithIp } from "./_core/rateLimit";
import { getClientIp } from "./_core/requestIp";
import { isUniqueViolation, throwBusinessError } from "./_core/errors";
import { DUPLICATE_ADMIN_EMAIL_MSG } from "@shared/const";
import { writeAuditLog } from "./_core/audit";
import { enrichSuperAdminCompany } from "./_core/superAdminCompanies";
import { getLandingPageConfig, saveLandingPageConfig } from "./landingSettings";
import { landingPageConfigSchema } from "@shared/landingConfig";
import { syncAllCompaniesSubscriptionEnforcement, deactivateCompanyIfSubscriptionViolated } from "./_core/subscriptionEnforcement";
import {
  SUBSCRIPTION_PLANS,
  addTrialDays,
  assertCanAddEmployee,
  getSubscriptionAccessStatus,
  type SubscriptionPlan,
} from "@shared/subscriptionPlans";
import {
  buildEmployeeExportBundle,
  buildLaborReportBundle,
  listAuditLogsFiltered,
} from "./_core/laborReportBundle";
import {
  restaurants,
  employees,
  schedules,
  timeclocks,
  timeclockBreaks,
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
import { isDemoModeEnabled, isDemoRequestActive, buildDemoSession } from "./demo/mode";
import {
  demoAcceptPrivacy,
  demoClockIn,
  demoClockOut,
  demoPauseClock,
  demoResumeClock,
  demoCreateSuperCompany,
  demoMutationSuccess,
  demoSetCompanyStatus,
  demoSetCompanySubscription,
  demoUpdateCompanyLegal,
  demoUpsertRestaurant,
  getDemoScheduleMap,
  getDemoSuperCompanies,
  getDemoTimeOff,
  getDemoNotificationLogs,
  demoHasPrivacyAcceptance,
  getDemoCompany,
  getDemoRestaurant,
  getDemoEmployees,
} from "./demo/store";

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
    getAppConfig: publicProcedure.query(() => ({
      demoMode: isDemoModeEnabled(),
      registrationAvailable: Boolean(process.env.DATABASE_URL?.trim()),
    })),

    getLandingPageConfig: publicProcedure.query(async () => getLandingPageConfig()),

    registerBusiness: publicProcedure
      .input(
        z
          .object({
            businessName: z.string().trim().min(2, "El nombre del negocio es obligatorio"),
            adminName: z.string().trim().min(2, "El nombre del responsable es obligatorio"),
            email: z.string().trim().email("Introduce un email válido"),
            password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
            confirmPassword: z.string().min(8),
            country: z.string().trim().min(2).default("ES"),
            timezone: z.string().trim().min(1).default("Europe/Madrid"),
            phone: z.string().trim().optional(),
            address: z.string().trim().optional(),
            acceptedTerms: z.boolean().refine((value) => value === true, {
              message: "Debes aceptar los términos y la política de privacidad",
            }),
          })
          .refine((data) => data.password === data.confirmPassword, {
            message: "Las contraseñas no coinciden",
            path: ["confirmPassword"],
          })
      )
      .mutation(async ({ ctx, input }) => {
        if (!process.env.DATABASE_URL?.trim()) {
          throw new Error(
            "El registro requiere base de datos configurada. Configura DATABASE_URL en tu entorno."
          );
        }
        const emailKey = input.email.trim().toLowerCase();
        checkRateLimit(`register-business:ip:${getClientIp(ctx.req)}`, 15, 60_000);
        checkRateLimit(`register-business:${emailKey}`, 5, 3_600_000);

        let result;
        try {
          result = await registerBusinessTenant({
            businessName: input.businessName,
            adminName: input.adminName,
            email: input.email,
            passwordHash: hashPassword(input.password),
            country: input.country,
            timezone: input.timezone,
            address: input.address,
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new Error(DUPLICATE_ADMIN_EMAIL_MSG);
          }
          throw error;
        }

        await setSessionCookie(ctx.res, ctx.req, {
          type: "admin",
          companyId: result.companyId,
          companySlug: result.companySlug,
          userId: result.adminId,
          displayName: result.adminUsername,
        });

        return {
          success: true as const,
          companySlug: result.companySlug,
          companyName: result.companyName,
          adminUsername: result.adminUsername,
          adminEmail: result.adminEmail,
          scopedLogin: `${result.companySlug}::${result.adminUsername}`,
          autoLoggedIn: true,
        };
      }),

    enterDemo: publicProcedure
      .input(z.object({ role: z.enum(["admin", "employee", "superadmin"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!isDemoModeEnabled()) {
          throw new Error("Modo demo no disponible. Configura DEMO_MODE=true o DATABASE_URL vacío.");
        }
        const session = buildDemoSession(input.role);
        await setSessionCookie(ctx.res, ctx.req, session);
        if (input.role === "employee") {
          return {
            success: true,
            role: input.role,
            employeeId: 1,
            companySlug: "demo",
            schedule: getDemoScheduleMap(),
            lateGraceMinutes: 5,
            locationEnabled: false,
            needsPrivacyNotice: !demoHasPrivacyAcceptance(1),
            timezone: "Europe/Madrid",
          };
        }
        if (input.role === "admin") {
          return { success: true, role: input.role, companySlug: "demo" };
        }
        return { success: true, role: input.role };
      }),

    superAdminLogin: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`superadmin-login:ip:${getClientIp(ctx.req)}`, 5, 60_000);
        requireSuperAdminCredentials({
          username: input.username,
          password: input.password,
        });
        await setSessionCookie(ctx.res, ctx.req, {
          type: "superadmin",
          isDemo: isDemoModeEnabled(),
          displayName: "Superadmin",
        });
        return { success: true };
      }),

    superAdminListCompanies: publicProcedure
      .input(
        optionalCreds
      )
      .query(async ({ ctx, input }) => {
        await resolveSuperAdminAuth(ctx, input);
        if (isDemoModeEnabled()) {
          return getDemoSuperCompanies().map((company) =>
            enrichSuperAdminCompany(company, company.employeeCount ?? 0)
          );
        }
        await syncAllCompaniesSubscriptionEnforcement();
        const db = await getDb();
        if (!db) return [];
        const companyRows = await db.select().from(companies).orderBy(desc(companies.createdAt));
        const employeeCounts = await countEmployeesByCompany(companyRows.map((c) => c.id));
        const adminRows = await db
          .select()
          .from(users)
          .where(and(eq(users.role, "admin"), sql`${users.openId} LIKE 'local-admin-%'`));
        const adminByCompany = new Map(
          adminRows
            .filter((row) => row.companyId != null)
            .map((row) => [row.companyId as number, row])
        );
        return companyRows.map((company) =>
          enrichSuperAdminCompany(
            {
              ...company,
              adminUsername: adminByCompany.get(company.id)?.name ?? null,
            },
            employeeCounts.get(company.id) ?? 0
          )
        );
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
        if (isDemoModeEnabled()) {
          return demoCreateSuperCompany(input);
        }
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
          subscriptionPlan: "trial",
          trialEndsAt: addTrialDays(new Date()),
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
        optionalCreds.extend({
          companyId: z.number().int().positive(),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await resolveSuperAdminAuth(ctx, input);
        if (isDemoModeEnabled()) {
          return demoSetCompanyStatus(input.companyId, input.isActive);
        }
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

    superAdminGetLandingSettings: publicProcedure.input(optionalCreds).query(async ({ ctx, input }) => {
      await resolveSuperAdminAuth(ctx, input);
      return getLandingPageConfig();
    }),

    superAdminUpdateLandingSettings: publicProcedure
      .input(optionalCreds.extend({ config: landingPageConfigSchema }))
      .mutation(async ({ ctx, input }) => {
        await resolveSuperAdminAuth(ctx, input);
        const config = await saveLandingPageConfig(input.config);
        return { success: true as const, config };
      }),

    superAdminSetCompanySubscription: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
          companyId: z.number().int().positive(),
          subscriptionPlan: z.enum(SUBSCRIPTION_PLANS),
          trialEndsAt: z.string().datetime().optional().nullable(),
        })
      )
      .mutation(async ({ input }) => {
        requireSuperAdminCredentials({
          username: input.username,
          password: input.password,
        });
        const plan = input.subscriptionPlan as SubscriptionPlan;
        let trialEndsAt: Date | null = null;
        if (plan === "trial") {
          trialEndsAt = input.trialEndsAt
            ? new Date(input.trialEndsAt)
            : addTrialDays(new Date());
        } else if (input.trialEndsAt) {
          trialEndsAt = new Date(input.trialEndsAt);
        }
        if (isDemoModeEnabled()) {
          return demoSetCompanySubscription(input.companyId, plan, trialEndsAt);
        }
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
          .set({
            subscriptionPlan: plan,
            trialEndsAt,
            updatedAt: new Date(),
          })
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
      if (isDemoRequestActive()) {
        await resolveAdminAuth(ctx, input);
        return demoUpsertRestaurant(input);
      }
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
        employeeEmail: z.string().email(),
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
      const employeeCounts = await countEmployeesByCompany([company.id]);
      assertCanAddEmployee(company, employeeCounts.get(company.id) ?? 0);
      const normalizedEmail = normalizeEmployeeEmail(input.employeeEmail);
      const existingEmail = await getEmployeeByEmail(normalizedEmail, restaurant.companyId);
      if (existingEmail) {
        throw new Error(DUPLICATE_EMPLOYEE_EMAIL_MSG);
      }
      try {
        await db.insert(employees).values({
          companyId: restaurant.companyId,
          restaurantId: restaurant.id,
          name: input.employeeName,
          username: input.employeeUsername,
          email: normalizedEmail,
          password: hashPassword(input.employeePassword),
          phone: input.employeePhone,
          lateGraceMinutes: input.lateGraceMinutes,
          isActive: true,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new Error(DUPLICATE_EMPLOYEE_EMAIL_MSG);
        }
        throw error;
      }
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
      await deactivateCompanyIfSubscriptionViolated(company.id);
      return { success: true };
    }),

    updateEmployee: publicProcedure.input(
      z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        employeeId: z.number(),
        employeeName: z.string().min(1),
        employeeEmail: z.string().email(),
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
        email: normalizeEmployeeEmail(input.employeeEmail),
        phone: input.employeePhone ?? null,
        lateGraceMinutes: input.lateGraceMinutes,
      };
      const existingEmail = await getEmployeeByEmail(
        normalizeEmployeeEmail(input.employeeEmail),
        company.id
      );
      if (existingEmail && existingEmail.id !== input.employeeId) {
        throw new Error(DUPLICATE_EMPLOYEE_EMAIL_MSG);
      }
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
      await db.delete(incidents).where(
        and(inArray(incidents.employeeId, employeeIds), eq(incidents.companyId, company.id))
      );

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
      if (isDemoRequestActive()) return getDemoNotificationLogs();
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

    getEmployeeClockStatus: publicProcedure.input(
      optionalCreds.extend({
        employeeId: z.number(),
      })
    ).query(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      return getEmployeeClockPauseState(employee.id, employee.companyId);
    }),

    pauseClock: publicProcedure.input(
      optionalCreds.extend({
        employeeId: z.number(),
      })
    ).mutation(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      if (isDemoRequestActive()) {
        return demoPauseClock(employee.id);
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const openRecord = await getLatestOpenTimeclockByEmployee(employee.id, employee.companyId);
      if (!openRecord) throwBusinessError("Debes fichar entrada antes de pausar");
      const existingBreak = await getOpenBreakForTimeclock(openRecord.id, employee.companyId);
      if (existingBreak) throwBusinessError("Ya estás en pausa");
      await db.insert(timeclockBreaks).values({
        companyId: employee.companyId,
        employeeId: employee.id,
        timeclockId: openRecord.id,
        startedAt: new Date(),
      });
      return { success: true as const, isPaused: true };
    }),

    resumeClock: publicProcedure.input(
      optionalCreds.extend({
        employeeId: z.number(),
      })
    ).mutation(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      if (isDemoRequestActive()) {
        return demoResumeClock(employee.id);
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const openRecord = await getLatestOpenTimeclockByEmployee(employee.id, employee.companyId);
      if (!openRecord) throwBusinessError("No hay fichaje de entrada activo");
      const existingBreak = await getOpenBreakForTimeclock(openRecord.id, employee.companyId);
      if (!existingBreak) throwBusinessError("No estás en pausa");
      await db
        .update(timeclockBreaks)
        .set({ endedAt: new Date() })
        .where(eq(timeclockBreaks.id, existingBreak.id));
      return { success: true as const, isPaused: false };
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
        timezone: company?.timezone ?? "Europe/Madrid",
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
      if (isDemoRequestActive()) {
        return { ...demoClockIn(employee.id), isLate: false };
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const company = await getCompanyById(employee.companyId);
      const restaurant = await getRestaurantById(employee.restaurantId, employee.companyId);
      if (!restaurant) throwBusinessError("Negocio no encontrado");

      if (company?.locationEnabled) {
        if (input.latitude === undefined || input.longitude === undefined) {
          throwBusinessError("Se requiere ubicación para fichar en este negocio");
        }
        const distance = calculateDistance(
          parseFloat(restaurant.latitude.toString()),
          parseFloat(restaurant.longitude.toString()),
          input.latitude,
          input.longitude
        );
        if (distance > restaurant.radiusMeters) {
          throwBusinessError(
            `No estás dentro del radio permitido (${restaurant.radiusMeters} m). Acércate al local o pide al admin ampliar el radio en Restaurante.`
          );
        }
      }
      const openRecord = await getLatestOpenTimeclockByEmployee(
        input.employeeId,
        employee.companyId
      );
      if (openRecord) {
        throwBusinessError("Debes fichar salida antes de volver a entrar");
      }
      const now = new Date();
      const graceMinutes = employee.lateGraceMinutes ?? 5;
      const tz = company?.timezone ?? "Europe/Madrid";
      const dayOfWeek = getDayOfWeekInTimeZone(now, tz);
      const todayTimeclocks = await getTodayTimeclocksByEmployee(
        input.employeeId,
        now,
        employee.companyId,
        tz
      );
      const completedShifts = todayTimeclocks.filter(tc => tc.exitTime).length;
      const schedule =
        completedShifts === 0
          ? await getScheduleByEmployeeAndDay(input.employeeId, dayOfWeek, employee.companyId)
          : completedShifts === 1
          ? await getScheduleByEmployeeDayAndSlot(
              input.employeeId,
              dayOfWeek,
              2,
              employee.companyId
            )
          : undefined;
      if (schedule && schedule.isWorkDay && schedule.entryTime !== "00:00") {
        const parsed = parseScheduleEntryTime(schedule.entryTime);
        if (parsed) {
          const { earliest, latest } = getClockWindowMinutes(
            parsed.hour,
            parsed.minute,
            graceMinutes,
            EARLY_CLOCK_MINUTES
          );
          const nowMinutes = getMinutesSinceMidnightInTimeZone(now, tz);
          if (nowMinutes < earliest) {
            throwBusinessError(
              `Fichaje disponible desde ${EARLY_CLOCK_MINUTES} min antes de tu hora (${formatScheduleTime(parsed.hour, parsed.minute)}).`
            );
          }
          if (nowMinutes > latest) {
            throwBusinessError(
              `Fichaje no permitido: has superado los ${graceMinutes} minutos de gracia desde la hora de entrada.`
            );
          }
        }
      }
      await db.insert(timeclocks).values({
        companyId: employee.companyId,
        employeeId: input.employeeId,
        entryTime: now,
        isLate: false,
        status: "valid",
        source: "mobile",
        latitude:
          input.latitude !== undefined ? input.latitude.toString() : null,
        longitude:
          input.longitude !== undefined ? input.longitude.toString() : null,
      });
      return { success: true, isLate: false };
    }),

    clockOut: publicProcedure.input(
      optionalCreds.extend({
        employeeId: z.number(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    ).mutation(async ({ ctx, input }) => {
      const employee = await resolveEmployeeAuth(ctx, input);
      if (isDemoRequestActive()) {
        return demoClockOut(employee.id);
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const company = await getCompanyById(employee.companyId);
      const restaurant = await getRestaurantById(employee.restaurantId, employee.companyId);
      if (!restaurant) throwBusinessError("Negocio no encontrado");

      if (company?.locationEnabled) {
        if (input.latitude === undefined || input.longitude === undefined) {
          throwBusinessError("Se requiere ubicación para fichar en este negocio");
        }
        const distance = calculateDistance(
          parseFloat(restaurant.latitude.toString()),
          parseFloat(restaurant.longitude.toString()),
          input.latitude,
          input.longitude
        );
        if (distance > restaurant.radiusMeters) {
          throwBusinessError(
            `No estás dentro del radio permitido (${restaurant.radiusMeters} m). Acércate al local o pide al admin ampliar el radio en Restaurante.`
          );
        }
      }
      const openRecord = await getLatestOpenTimeclockByEmployee(input.employeeId, employee.companyId);
      if (!openRecord) throwBusinessError("No hay fichaje de entrada activo");
      const now = new Date();
      await closeOpenBreakForTimeclock(openRecord.id, employee.companyId, now);
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
      if (isDemoRequestActive()) {
        return { ...demoClockIn(employee.id), isLate: false };
      }
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
        if (isDemoRequestActive()) return getDemoTimeOff(input.status);
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
        if (isDemoRequestActive()) {
          await resolveAdminAuth(ctx, input);
          return demoMutationSuccess();
        }
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
        if (isDemoRequestActive()) return { days: [] };
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

    getTodayWorkforceStatus: publicProcedure
      .input(optionalCreds)
      .query(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        const restaurant = await getRestaurantByAdmin(admin.id, company.id);
        if (!restaurant) {
          return {
            date: todayYmdInTimeZone(company.timezone || "Europe/Madrid"),
            working: [],
            onBreak: [],
            notClockedIn: [],
            onTimeOff: [],
            finishedToday: [],
          };
        }
        const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id, company.id);
        const activeEmployees = restaurantEmployees.filter((e) => e.isActive !== false);
        const tz = company.timezone || "Europe/Madrid";
        const todayStr = todayYmdInTimeZone(tz);
        const snapshot = await getAdminWorkforceToday(
          activeEmployees.map((e) => ({ id: e.id, name: e.name })),
          company.id,
          todayStr
        );
        return { date: todayStr, ...snapshot };
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

        // endpoint UNIQUE globally: same browser reassigns to latest employee on subscribe.
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
          name: z.string().min(2).optional(),
          legalName: z.string().optional(),
          taxId: z.string().optional(),
          address: z.string().optional(),
          privacyContactEmail: z.string().email().optional().or(z.literal("")),
          country: z.string().length(2).optional(),
          timezone: z.string().optional(),
          locationEnabled: z.boolean().optional(),
          dataRetentionYears: z.number().min(4).max(10).optional(),
          legalOnboardingAcknowledged: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { company, admin } = await resolveAdminAuth(ctx, input);
        if (isDemoRequestActive()) {
          const update: Record<string, unknown> = { updatedAt: new Date() };
          if (input.name !== undefined) update.name = input.name.trim();
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
          if (input.legalOnboardingAcknowledged) {
            update.onboardingLegalAcknowledgedAt = new Date();
          }
          return demoUpdateCompanyLegal(update);
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const update: Record<string, unknown> = { updatedAt: new Date() };
        if (input.name !== undefined) update.name = input.name.trim();
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
        if (input.legalOnboardingAcknowledged) {
          update.onboardingLegalAcknowledgedAt = new Date();
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

    getOnboardingStatus: publicProcedure.input(optionalCreds).query(async ({ ctx, input }) => {
      if (ctx.session?.isDemo && ctx.session.type === "admin") {
        const restaurant = getDemoRestaurant();
        const demoEmployees = getDemoEmployees();
        return {
          onboardingCompleted: true,
          onboardingSkippedAt: null,
          onboardingCompletedAt: new Date(),
          onboardingLegalAcknowledgedAt: new Date(),
          employeeCount: demoEmployees.length,
          hasRestaurant: true,
          company: getDemoCompany(),
          restaurant,
          subscription: getSubscriptionAccessStatus(getDemoCompany(), demoEmployees.length),
        };
      }
      const { admin, company } = await resolveAdminAuth(ctx, input);
      const restaurant = await getRestaurantByAdmin(admin.id, company.id);
      const employeeList = restaurant
        ? await getEmployeesByRestaurant(restaurant.id, company.id)
        : [];
      return {
        onboardingCompleted: company.onboardingCompleted,
        onboardingSkippedAt: company.onboardingSkippedAt,
        onboardingCompletedAt: company.onboardingCompletedAt,
        onboardingLegalAcknowledgedAt: company.onboardingLegalAcknowledgedAt,
        employeeCount: employeeList.length,
        hasRestaurant: Boolean(restaurant),
        company,
        restaurant: restaurant ?? null,
        subscription: getSubscriptionAccessStatus(company, employeeList.length),
      };
    }),

    skipOnboarding: publicProcedure.input(optionalCreds).mutation(async ({ ctx, input }) => {
      if (ctx.session?.isDemo && ctx.session.type === "admin") {
        return { success: true as const };
      }
      const { company } = await resolveAdminAuth(ctx, input);
      if (company.onboardingCompleted) {
        return { success: true as const };
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const now = new Date();
      await db
        .update(companies)
        .set({ onboardingSkippedAt: now, updatedAt: now })
        .where(eq(companies.id, company.id));
      return { success: true as const };
    }),

    completeOnboarding: publicProcedure
      .input(
        optionalCreds.extend({
          legalAcknowledged: z.boolean().refine((value) => value === true, {
            message: "Debes confirmar la revisión de los textos legales",
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.session?.isDemo && ctx.session.type === "admin") {
          return { success: true as const };
        }
        const { company, admin } = await resolveAdminAuth(ctx, input);
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const now = new Date();
        await db
          .update(companies)
          .set({
            onboardingCompleted: true,
            onboardingCompletedAt: now,
            onboardingSkippedAt: null,
            onboardingLegalAcknowledgedAt: company.onboardingLegalAcknowledgedAt ?? now,
            updatedAt: now,
          })
          .where(eq(companies.id, company.id));
        await writeAuditLog({
          companyId: company.id,
          entityType: "company",
          entityId: company.id,
          action: "complete_onboarding",
          newValue: { onboardingCompleted: true },
          performedByType: "admin",
          performedById: admin.id,
        });
        return { success: true as const };
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
        if (isDemoRequestActive()) {
          const ip =
            (ctx.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
            ctx.req.socket.remoteAddress ??
            null;
          return demoAcceptPrivacy(employee.id, ip);
        }
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
      .input(
        optionalCreds.extend({
          dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          entityType: z.enum(["timeclock", "employee", "company", "incident"]).optional(),
          action: z.string().optional(),
          employeeId: z.number().optional(),
          limit: z.number().min(1).max(500).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { company } = await resolveAdminAuth(ctx, input);
        const now = new Date();
        const defaultFrom = new Date(now);
        defaultFrom.setDate(defaultFrom.getDate() - 30);
        const pad = (n: number) => String(n).padStart(2, "0");
        const defaultFromStr = `${defaultFrom.getFullYear()}-${pad(defaultFrom.getMonth() + 1)}-${pad(defaultFrom.getDate())}`;
        const defaultToStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        return listAuditLogsFiltered({
          companyId: company.id,
          dateFrom: input.dateFrom ?? defaultFromStr,
          dateTo: input.dateTo ?? defaultToStr,
          entityType: input.entityType,
          action: input.action,
          employeeId: input.employeeId,
          limit: input.limit ?? 200,
        });
      }),

    getLaborReportBundle: publicProcedure
      .input(
        optionalCreds.extend({
          employeeId: z.number().optional(),
          dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          includeAuditHistory: z.boolean().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        return buildLaborReportBundle({
          companyId: company.id,
          adminId: admin.id,
          employeeId: input.employeeId,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          includeAuditHistory: input.includeAuditHistory ?? false,
        });
      }),

    exportEmployeeData: publicProcedure
      .input(
        optionalCreds.extend({
          employeeId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { admin, company } = await resolveAdminAuth(ctx, input);
        return buildEmployeeExportBundle(company.id, admin.id, input.employeeId);
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

  // Legacy routers (deprecated — blocked; use publicApi.*)
  restaurant: router({
    getByAdmin: deprecatedProcedure.query(() => null as never),
    create: deprecatedProcedure
      .input(
        z.object({
          name: z.string(),
          address: z.string(),
          latitude: z.number(),
          longitude: z.number(),
          radiusMeters: z.number().optional(),
        })
      )
      .mutation(() => ({ success: true as const })),
    update: deprecatedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(() => ({ success: true as const })),
  }),

  employee: router({
    list: deprecatedProcedure.query(() => [] as never),
    create: deprecatedProcedure
      .input(
        z.object({
          name: z.string(),
          username: z.string(),
          password: z.string(),
          phone: z.string().optional(),
        })
      )
      .mutation(() => ({ success: true as const })),
    getById: deprecatedProcedure.input(z.number()).query(() => null as never),
  }),

  schedule: router({
    getByEmployee: deprecatedProcedure.input(z.number()).query(() => [] as never),
    create: deprecatedProcedure
      .input(
        z.object({
          employeeId: z.number(),
          dayOfWeek: z.number(),
          entryTime: z.string(),
          exitTime: z.string().optional(),
          isWorkDay: z.boolean().optional(),
        })
      )
      .mutation(() => ({ success: true as const })),
  }),

  timeclock: router({
    getByEmployee: deprecatedProcedure.input(z.number()).query(() => [] as never),
    clockIn: deprecatedProcedure
      .input(
        z.object({
          employeeId: z.number(),
          latitude: z.number(),
          longitude: z.number(),
        })
      )
      .mutation(() => ({ success: true as const, isLate: false })),
    clockOut: deprecatedProcedure
      .input(
        z.object({
          employeeId: z.number(),
          latitude: z.number(),
          longitude: z.number(),
        })
      )
      .mutation(() => ({ success: true as const })),
  }),

  incident: router({
    getByEmployee: deprecatedProcedure.input(z.number()).query(() => [] as never),
    create: deprecatedProcedure
      .input(
        z.object({
          employeeId: z.number(),
          timeclockId: z.number().optional(),
          type: z.enum(["late_arrival", "early_exit", "other"]),
          reason: z.string(),
        })
      )
      .mutation(() => ({ success: true as const })),
    list: deprecatedProcedure.query(() => [] as never),
    updateStatus: deprecatedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "approved", "rejected"]),
        })
      )
      .mutation(() => ({ success: true as const })),
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
