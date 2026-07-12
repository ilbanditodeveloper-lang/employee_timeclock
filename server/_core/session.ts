import { SignJWT, jwtVerify } from "jose";

import type { Response } from "express";

import { COOKIE_NAME, SESSION_IDLE_TIMEOUT_MS, SESSION_MAX_AGE_MS } from "@shared/const";

import { getSessionCookieOptions } from "./cookies";

import { ENV } from "./env";

export type SessionRole = "admin" | "employee" | "superadmin";

export type AppSession = {
  type: SessionRole;
  companyId?: number;
  companySlug?: string;
  userId?: number;
  employeeId?: number;
  displayName?: string;
  /** Sesión de modo demo (sin base de datos). */
  isDemo?: boolean;
  /** Unix ms — stored in JWT for idle timeout. */
  lastActivity?: number;
  /** Campos enriquecidos en getSession (no se guardan en el JWT). */
  locationEnabled?: boolean;
  timezone?: string;
  lateGraceMinutes?: number;
  needsPrivacyNotice?: boolean;
};

function getSecret(): Uint8Array {
  const secret = ENV.cookieSecret || process.env.JWT_SECRET;
  if (!secret) {
    if (ENV.isProduction) {
      throw new Error("JWT_SECRET is required in production");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export function isSessionIdleExpired(lastActivity: number, now = Date.now()): boolean {
  return now - lastActivity > SESSION_IDLE_TIMEOUT_MS;
}

export function touchSession(session: AppSession): AppSession {
  return { ...session, lastActivity: Date.now() };
}

/** Strip enriched getSession fields before persisting to JWT. */
export function sessionToJwtPayload(session: AppSession): AppSession {
  return {
    type: session.type,
    companyId: session.companyId,
    companySlug: session.companySlug,
    userId: session.userId,
    employeeId: session.employeeId,
    displayName: session.displayName,
    isDemo: session.isDemo,
    lastActivity: session.lastActivity ?? Date.now(),
  };
}

export async function signSession(session: AppSession): Promise<string> {
  const payload = sessionToJwtPayload(session);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<AppSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const type = payload.type as SessionRole | undefined;
    if (!type || !["admin", "employee", "superadmin"].includes(type)) {
      return null;
    }

    const lastActivity =
      typeof payload.lastActivity === "number"
        ? payload.lastActivity
        : Date.now();

    if (isSessionIdleExpired(lastActivity)) {
      return null;
    }

    return {
      type,
      companyId: typeof payload.companyId === "number" ? payload.companyId : undefined,
      companySlug: typeof payload.companySlug === "string" ? payload.companySlug : undefined,
      userId: typeof payload.userId === "number" ? payload.userId : undefined,
      employeeId: typeof payload.employeeId === "number" ? payload.employeeId : undefined,
      displayName: typeof payload.displayName === "string" ? payload.displayName : undefined,
      isDemo: payload.isDemo === true,
      lastActivity,
    };
  } catch {
    return null;
  }
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${COOKIE_NAME}=`)) {
      return decodeURIComponent(part.slice(COOKIE_NAME.length + 1));
    }
  }
  return null;
}

export async function setSessionCookie(
  res: Response,
  req: Parameters<typeof getSessionCookieOptions>[0],
  session: AppSession
) {
  const token = await signSession(session);
  const options = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, token, {
    ...options,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(
  res: Response,
  req: Parameters<typeof getSessionCookieOptions>[0]
) {
  const options = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...options, maxAge: -1 });
}

/** tRPC paths that must not extend idle window (background session poll). */
export const SESSION_HEARTBEAT_PATHS = new Set(["publicApi.getSession"]);
