import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { demoRequestStorage } from "../demo/mode";
import { sanitizeErrorMessage } from "./errors";
import { ENV } from "./env";
import {
  clearSessionCookie,
  isSessionIdleExpired,
  SESSION_HEARTBEAT_PATHS,
  setSessionCookie,
  sessionToJwtPayload,
  touchSession,
} from "./session";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const message = sanitizeErrorMessage(shape.message);
    return {
      ...shape,
      message,
      data: {
        ...shape.data,
        stack: ENV.isProduction ? undefined : error.stack,
      },
    };
  },
});

const demoMiddleware = t.middleware(async ({ ctx, next }) => {
  if (ctx.isDemo && ctx.session) {
    return demoRequestStorage.run({ session: ctx.session }, () => next({ ctx }));
  }
  return next({ ctx });
});

const sessionIdleMiddleware = t.middleware(async ({ ctx, next, path }) => {
  if (!ctx.session) return next({ ctx });

  const lastActivity = ctx.session.lastActivity ?? Date.now();
  if (isSessionIdleExpired(lastActivity)) {
    clearSessionCookie(ctx.res, ctx.req);
    return next({ ctx: { ...ctx, session: null } });
  }

  if (!SESSION_HEARTBEAT_PATHS.has(path)) {
    const touched = touchSession(ctx.session);
    await setSessionCookie(ctx.res, ctx.req, sessionToJwtPayload(touched));
    return next({ ctx: { ...ctx, session: touched } });
  }

  return next({ ctx });
});

/** Legacy OAuth/Manus routers — blocked in Fase 3 (use publicApi instead). */
const deprecatedMiddleware = t.middleware(() => {
  throw new TRPCError({ code: "NOT_FOUND", message: "Endpoint no disponible" });
});

export const router = t.router;
export const publicProcedure = t.procedure.use(demoMiddleware).use(sessionIdleMiddleware);
export const deprecatedProcedure = publicProcedure.use(deprecatedMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
