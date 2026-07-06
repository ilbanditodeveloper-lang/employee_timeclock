import type { TrpcContext } from "./context";
import type { Company } from "../../drizzle/schema";
import {
  getCompanyById,
  getCompanyBySlug,
  getEmployeeById,
  getEmployeeByUsername,
  getLocalAdminByCompany,
  getAdminUserByEmail,
  findAdminsByLoginName,
  findEmployeesByLoginUsername,
  findEmployeesByLoginEmail,
  normalizeEmployeeEmail,
  getEmployeeByEmail,
} from "../db";
import { hashPassword, verifyPassword } from "./password";
import { getDb } from "../db";
import { employees, users } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { checkRateLimit, checkRateLimitWithIp } from "./rateLimit";
import { getClientIp } from "./requestIp";
import { GENERIC_AUTH_FAILURE_MSG, SESSION_AUTH_ERR_MSG, SESSION_INVALID_ERR_MSG } from "@shared/const";
import { assertSubscriptionAllowsAccess } from "@shared/subscriptionPlans";
import { loadCompanyAfterSubscriptionSync } from "./subscriptionEnforcement";
import { throwAuthError, throwBusinessError } from "./errors";
import {
  getDemoAdmin,
  getDemoCompany,
  getDemoEmployeeById,
} from "../demo/store";
import { isDemoRequestActive } from "../demo/mode";

export function parseScopedUsername(rawValue: string): { companySlug: string; username: string } {
  const raw = rawValue.trim();
  const parts = raw.split("::");
  if (parts.length > 1) {
    return {
      companySlug: normalizeCompanySlug(parts[0]),
      username: parts.slice(1).join("::").trim(),
    };
  }
  return { companySlug: "default", username: raw };
}

export function normalizeCompanySlug(rawSlug: string | undefined | null): string {
  return (rawSlug ?? "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "default";
}

export function requireSuperAdminCredentials(params: { username: string; password: string }) {
  const expectedUsername = process.env.SUPERADMIN_USERNAME;
  const expectedPassword = process.env.SUPERADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    throwBusinessError(
      "Superadmin no configurado. Define SUPERADMIN_USERNAME y SUPERADMIN_PASSWORD en el entorno."
    );
  }
  if (params.username !== expectedUsername || params.password !== expectedPassword) {
    throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
  }
}

async function ensureCompanySubscriptionAccess(company: Company): Promise<Company> {
  if (isDemoRequestActive()) return company;
  const fresh = await loadCompanyAfterSubscriptionSync(company.id);
  if (!fresh) throw new Error("Empresa no disponible");
  assertSubscriptionAllowsAccess(fresh);
  return fresh;
}

export async function requireAdminUser(params: {
  username: string;
  password: string;
  clientIp?: string;
}) {
  const ip = params.clientIp ?? "unknown";
  checkRateLimitWithIp("admin-login", ip, params.username);
  const raw = params.username.trim();

  if (raw.includes("@") && !raw.includes("::")) {
    const normalizedEmail = raw.toLowerCase();
    const existingAdmin = await getAdminUserByEmail(normalizedEmail);
    if (!existingAdmin) {
      throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
    }
    const company = await getCompanyById(existingAdmin.companyId);
    if (!company || !company.isActive) {
      throw new Error("Empresa no disponible");
    }

    const check = verifyPassword(params.password, existingAdmin.password);
    if (!check.isValid) {
      throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
    }

    if (check.needsUpgrade) {
      const db = await getDb();
      if (db) {
        await db
          .update(users)
          .set({ password: hashPassword(params.password) })
          .where(eq(users.id, existingAdmin.id));
      }
    }

    const syncedCompany = await ensureCompanySubscriptionAccess(company);
    return { company: syncedCompany, admin: existingAdmin };
  }

  if (!raw.includes("::")) {
    const matches = await findAdminsByLoginName(raw);
    if (matches.length > 1) {
      throw new Error("Varias empresas usan ese usuario. Entra con tu email y contraseña.");
    }
    if (matches.length === 1) {
      const { user: existingAdmin, company } = matches[0];
      const check = verifyPassword(params.password, existingAdmin.password);
      if (!check.isValid) {
        throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
      }
      if (check.needsUpgrade) {
        const db = await getDb();
        if (db) {
          await db
            .update(users)
            .set({ password: hashPassword(params.password) })
            .where(eq(users.id, existingAdmin.id));
        }
      }
      const syncedCompany = await ensureCompanySubscriptionAccess(company);
      return { company: syncedCompany, admin: existingAdmin };
    }
  }

  const scoped = parseScopedUsername(params.username);
  const company = await getCompanyBySlug(scoped.companySlug);
  if (!company || !company.isActive) {
    throw new Error("Empresa no disponible");
  }

  const existingAdmin = await getLocalAdminByCompany(company.id);
  if (!existingAdmin) {
    throw new Error(
      "Administrador de empresa no configurado. Solicita al superadmin la creación de la cuenta."
    );
  }

  if ((existingAdmin.name ?? "") !== scoped.username) {
    throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
  }

  const check = verifyPassword(params.password, existingAdmin.password);
  if (!check.isValid) {
    throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
  }

  if (check.needsUpgrade) {
    const db = await getDb();
    if (db) {
      await db
        .update(users)
        .set({ password: hashPassword(params.password) })
        .where(eq(users.id, existingAdmin.id));
    }
  }

  const syncedCompany = await ensureCompanySubscriptionAccess(company);
  return { company: syncedCompany, admin: existingAdmin };
}

export async function validateEmployeeCredentials(params: {
  companySlug?: string;
  username: string;
  password: string;
  expectedEmployeeId?: number;
  clientIp?: string;
}) {
  const ip = params.clientIp ?? "unknown";
  checkRateLimitWithIp("employee-login", ip, params.username);
  const raw = params.username.trim();

  if (!raw.includes("::") && !params.companySlug) {
    if (raw.includes("@")) {
      const emailMatches = await findEmployeesByLoginEmail(raw);
      if (emailMatches.length > 1) {
        throw new Error(
          "Varios empleados usan ese email. Contacta con tu empresa."
        );
      }
      if (emailMatches.length === 1) {
        const { employee, company } = emailMatches[0];
        if (params.expectedEmployeeId !== undefined && employee.id !== params.expectedEmployeeId) {
          throw new Error("Empleado no encontrado");
        }
        const check = verifyPassword(params.password, employee.password);
        if (!check.isValid) {
          throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
        }
        if (check.needsUpgrade) {
          const db = await getDb();
          if (db) {
            await db
              .update(employees)
              .set({ password: hashPassword(params.password) })
              .where(and(eq(employees.id, employee.id), eq(employees.companyId, employee.companyId)));
          }
        }
        await ensureCompanySubscriptionAccess(company);
        return employee;
      }
    }

    const matches = await findEmployeesByLoginUsername(raw);
    if (matches.length > 1) {
      throw new Error(
        "Varios empleados usan ese usuario. Contacta con tu empresa o usa el acceso que te proporcionaron."
      );
    }
    if (matches.length === 1) {
      const { employee, company } = matches[0];
      if (params.expectedEmployeeId !== undefined && employee.id !== params.expectedEmployeeId) {
        throw new Error("Empleado no encontrado");
      }
      const check = verifyPassword(params.password, employee.password);
      if (!check.isValid) {
        throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
      }
      if (check.needsUpgrade) {
        const db = await getDb();
        if (db) {
          await db
            .update(employees)
            .set({ password: hashPassword(params.password) })
            .where(and(eq(employees.id, employee.id), eq(employees.companyId, employee.companyId)));
        }
      }
      await ensureCompanySubscriptionAccess(company);
      return employee;
    }

    throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
  }

  if (raw.includes("::") || params.companySlug) {
    const scoped = parseScopedUsername(params.username);
    const company = await getCompanyBySlug(params.companySlug ?? scoped.companySlug ?? "default");
    if (!company || !company.isActive) {
      throw new Error("Empresa no disponible");
    }

    const employee = await getEmployeeByUsername(scoped.username, company.id);
    if (!employee || (params.expectedEmployeeId !== undefined && employee.id !== params.expectedEmployeeId)) {
      throw new Error("Empleado no encontrado");
    }
    if (!employee.isActive) {
      throw new Error("Cuenta de empleado desactivada. Contacta con tu empresa.");
    }

    const check = verifyPassword(params.password, employee.password);
    if (!check.isValid) {
      throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
    }

    if (check.needsUpgrade) {
      const db = await getDb();
      if (db) {
        await db
          .update(employees)
          .set({ password: hashPassword(params.password) })
          .where(and(eq(employees.id, employee.id), eq(employees.companyId, company.id)));
      }
    }

    await ensureCompanySubscriptionAccess(company);
    return employee;
  }

  throwBusinessError(GENERIC_AUTH_FAILURE_MSG);
}

type CredentialInput = { username?: string; password?: string };

export async function resolveAdminAuth(ctx: TrpcContext, input?: CredentialInput) {
  if (ctx.session?.isDemo && ctx.session.type === "admin") {
    return { company: getDemoCompany(), admin: getDemoAdmin() };
  }
  if (ctx.session?.type === "admin" && ctx.session.companyId) {
    const company = await getCompanyById(ctx.session.companyId);
    const admin = await getLocalAdminByCompany(ctx.session.companyId);
    if (!company?.isActive || !admin) {
      throwAuthError(SESSION_INVALID_ERR_MSG);
    }
    const syncedCompany = await ensureCompanySubscriptionAccess(company);
    return { company: syncedCompany, admin };
  }
  if (input?.username && input?.password) {
    return requireAdminUser({
      username: input.username,
      password: input.password,
      clientIp: getClientIp(ctx.req),
    });
  }
  throwAuthError(SESSION_AUTH_ERR_MSG);
}

export async function resolveSuperAdminAuth(ctx: TrpcContext, input?: CredentialInput) {
  if (ctx.session?.isDemo && ctx.session.type === "superadmin") {
    return { success: true as const };
  }
  if (ctx.session?.type === "superadmin") {
    return { success: true as const };
  }
  if (input?.username && input?.password) {
    requireSuperAdminCredentials({ username: input.username, password: input.password });
    return { success: true as const };
  }
  throwAuthError("No autorizado");
}

export async function resolveEmployeeAuth(
  ctx: TrpcContext,
  input: CredentialInput & { employeeId?: number }
) {
  if (ctx.session?.isDemo && ctx.session.type === "employee" && ctx.session.employeeId) {
    const employee = getDemoEmployeeById(ctx.session.employeeId);
    if (!employee?.isActive) throw new Error("Cuenta de empleado desactivada.");
    if (input.employeeId !== undefined && input.employeeId !== employee.id) {
      throwAuthError("No autorizado para este empleado.");
    }
    return employee;
  }
  if (ctx.session?.type === "employee" && ctx.session.employeeId && ctx.session.companyId) {
    const employee = await getEmployeeById(ctx.session.employeeId, ctx.session.companyId);
    if (!employee?.isActive) {
      throw new Error("Cuenta de empleado desactivada.");
    }
    if (input.employeeId !== undefined && input.employeeId !== employee.id) {
      throwAuthError("No autorizado para este empleado.");
    }
    const company = await getCompanyById(ctx.session.companyId);
    if (!company?.isActive) {
      throw new Error("Empresa no disponible");
    }
    await ensureCompanySubscriptionAccess(company);
    return employee;
  }
  if (input.username && input.password) {
    return validateEmployeeCredentials({
      username: input.username,
      password: input.password,
      expectedEmployeeId: input.employeeId,
      clientIp: getClientIp(ctx.req),
    });
  }
  throwAuthError(SESSION_AUTH_ERR_MSG);
}

export async function assertEmployeeBelongsToAdminCompany(
  employeeId: number,
  companyId: number,
  restaurantId: number
) {
  if (isDemoRequestActive()) {
    const employee = getDemoEmployeeById(employeeId);
    if (!employee || employee.restaurantId !== restaurantId) {
      throw new Error("Empleado no encontrado en tu empresa");
    }
    return employee;
  }
  const employee = await getEmployeeById(employeeId, companyId);
  if (!employee || employee.restaurantId !== restaurantId) {
    throw new Error("Empleado no encontrado en tu empresa");
  }
  return employee;
}
