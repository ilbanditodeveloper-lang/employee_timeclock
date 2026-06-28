import { AsyncLocalStorage } from "node:async_hooks";
import type { AppSession } from "../_core/session";

const demoRequestStorage = new AsyncLocalStorage<{ session: AppSession }>();

export { demoRequestStorage };

export function isDemoModeEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.DEMO_MODE === "true") return true;
  return !process.env.DATABASE_URL?.trim();
}

export function isDemoSession(session: AppSession | null | undefined): boolean {
  return Boolean(session?.isDemo);
}

export function isDemoRequestActive(): boolean {
  return Boolean(demoRequestStorage.getStore());
}

export function runWithDemoContext<T>(
  session: AppSession,
  fn: () => T | Promise<T>
): Promise<T> {
  return Promise.resolve(demoRequestStorage.run({ session }, fn));
}

export function getDemoRequestSession(): AppSession | null {
  return demoRequestStorage.getStore()?.session ?? null;
}

export function buildDemoSession(role: "admin" | "employee" | "superadmin"): AppSession {
  if (role === "superadmin") {
    return { type: "superadmin", isDemo: true, displayName: "Superadmin Demo" };
  }
  if (role === "admin") {
    return {
      type: "admin",
      isDemo: true,
      companyId: 1,
      companySlug: "demo",
      userId: 1,
      displayName: "Admin Demo",
    };
  }
  return {
    type: "employee",
    isDemo: true,
    companyId: 1,
    companySlug: "demo",
    employeeId: 1,
    displayName: "Ana García",
  };
}
