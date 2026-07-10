import { SignJWT, jwtVerify } from "jose";

import type { Response } from "express";

import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";

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



export async function signSession(session: AppSession): Promise<string> {

  return new SignJWT({ ...session })

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

    return {

      type,

      companyId: typeof payload.companyId === "number" ? payload.companyId : undefined,

      companySlug: typeof payload.companySlug === "string" ? payload.companySlug : undefined,

      userId: typeof payload.userId === "number" ? payload.userId : undefined,

      employeeId: typeof payload.employeeId === "number" ? payload.employeeId : undefined,

      displayName: typeof payload.displayName === "string" ? payload.displayName : undefined,

      isDemo: payload.isDemo === true,

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



export async function setSessionCookie(res: Response, req: Parameters<typeof getSessionCookieOptions>[0], session: AppSession) {

  const token = await signSession(session);

  const options = getSessionCookieOptions(req);

  res.cookie(COOKIE_NAME, token, {
    ...options,
    maxAge: SESSION_MAX_AGE_MS,
  });

}



export function clearSessionCookie(res: Response, req: Parameters<typeof getSessionCookieOptions>[0]) {

  const options = getSessionCookieOptions(req);

  res.clearCookie(COOKIE_NAME, { ...options, maxAge: -1 });

}


