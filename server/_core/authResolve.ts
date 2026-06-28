import type { TrpcContext } from "./context";
import {
  getCompanyById,
  getCompanyBySlug,
  getEmployeeById,
  getEmployeeByUsername,
  getLocalAdminByCompany,
  getAdminUserByEmail,
} from "../db";
import { hashPassword, verifyPassword } from "./password";
import { getDb } from "../db";
import { employees, users } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { checkRateLimit, checkRateLimitWithIp } from "./rateLimit";
import { getClientIp } from "./requestIp";
import { GENERIC_AUTH_FAILURE_MSG } from "@shared/const";
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
    throw new Error(
      "Superadmin no configurado. Define SUPERADMIN_USERNAME y SUPERADMIN_PASSWORD en el entorno."
    );
  }
  if (params.username !== expectedUsername || params.password !== expectedPassword) {
    throw new Error(GENERIC_AUTH_FAILURE_MSG);
  }
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
      throw new Error(GENERIC_AUTH_FAILURE_MSG);
    }
    const company = await getCompanyById(existingAdmin.companyId);
    if (!company || !company.isActive) {
      throw new Error("Empresa no disponible");
    }

    const check = verifyPassword(params.password, existingAdmin.password);
    if (!check.isValid) {
      throw new Error(GENERIC_AUTH_FAILURE_MSG);
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

    return { company, admin: existingAdmin };
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
    throw new Error(GENERIC_AUTH_FAILURE_MSG);
  }

  const check = verifyPassword(params.password, existingAdmin.password);
  if (!check.isValid) {
    throw new Error(GENERIC_AUTH_FAILURE_MSG);
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

  return { company, admin: existingAdmin };
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
    throw new Error("Credenciales inválidas");
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

  return employee;
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
      throw new Error("Sesión inválida. Inicia sesión de nuevo.");
    }
    return { company, admin };
  }
  if (input?.username && input?.password) {
    return requireAdminUser({
      username: input.username,
      password: input.password,
      clientIp: getClientIp(ctx.req),
    });
  }
  throw new Error("No autorizado. Inicia sesión de nuevo.");
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
  throw new Error("No autorizado");
}

export async function resolveEmployeeAuth(
  ctx: TrpcContext,
  input: CredentialInput & { employeeId?: number }
) {
  if (ctx.session?.isDemo && ctx.session.type === "employee" && ctx.session.employeeId) {
    const employee = getDemoEmployeeById(ctx.session.employeeId);
    if (!employee?.isActive) throw new Error("Cuenta de empleado desactivada.");
    if (input.employeeId !== undefined && input.employeeId !== employee.id) {
      throw new Error("No autorizado para este empleado.");
    }
    return employee;
  }
  if (ctx.session?.type === "employee" && ctx.session.employeeId && ctx.session.companyId) {
    const employee = await getEmployeeById(ctx.session.employeeId, ctx.session.companyId);
    if (!employee?.isActive) {
      throw new Error("Cuenta de empleado desactivada.");
    }
    if (input.employeeId !== undefined && input.employeeId !== employee.id) {
      throw new Error("No autorizado para este empleado.");
    }
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
  throw new Error("No autorizado. Inicia sesión de nuevo.");
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
