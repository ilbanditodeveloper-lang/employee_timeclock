import dotenv from "dotenv";
// En Render/producción usar solo variables del dashboard — no .env.local del disco
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();
import express from "express";
import cors, { type CorsOptions } from "cors";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { checkAndSendNotifications } from "../notificationService";
import { ENV } from "./env";
import { securityHeaders } from "./securityHeaders";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function isCronAuthorized(req: express.Request, res: express.Response): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (ENV.isProduction && !secret) {
    res.status(503).json({ ok: false, error: "Cron not configured" });
    return false;
  }
  if (secret && req.query.secret !== secret) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  if (!ENV.isProduction && !secret) {
    console.warn(
      "[cron] CRON_SECRET no configurado — /api/cron/notifications accesible solo en desarrollo"
    );
  }
  return true;
}

function isInternalCronEnabled(): boolean {
  const flag = process.env.CRON_INTERNAL?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !ENV.isProduction;
}

function validateProductionEnv(): void {
  if (!ENV.isProduction) return;
  const missing: string[] = [];
  if (!process.env.JWT_SECRET?.trim()) missing.push("JWT_SECRET");
  if (!process.env.CRON_SECRET?.trim()) missing.push("CRON_SECRET");
  if (!process.env.SUPERADMIN_USERNAME?.trim()) missing.push("SUPERADMIN_USERNAME");
  if (!process.env.SUPERADMIN_PASSWORD?.trim()) missing.push("SUPERADMIN_PASSWORD");
  if (!process.env.FRONTEND_URL?.trim() && !process.env.VITE_APP_URL?.trim()) {
    missing.push("FRONTEND_URL or VITE_APP_URL");
  }
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  const isStrictProduction = appEnv !== "staging";
  if (isStrictProduction && process.env.DEMO_MODE === "true") {
    const appEnvLabel = appEnv || "(unset — usa APP_ENV=staging en Render staging)";
    console.error(
      `[startup] DEMO_MODE=true no permitido sin APP_ENV=staging (actual: ${appEnvLabel})`
    );
    process.exit(1);
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error("[startup] JWT_SECRET debe tener al menos 32 caracteres en producción");
    process.exit(1);
  }
  if (missing.length > 0) {
    console.error(`[startup] Variables obligatorias faltantes en producción: ${missing.join(", ")}`);
    process.exit(1);
  }
}

async function startServer() {
  validateProductionEnv();

  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);

  const appVersion = process.env.npm_package_version ?? "1.0.0";
  const healthPayload = () => ({
    ok: true,
    timestamp: new Date().toISOString(),
    env: ENV.isProduction ? "production" : "development",
    version: appVersion,
  });

  app.get("/healthz", (_req, res) => {
    res.json(healthPayload());
  });
  app.get("/api/health", (_req, res) => {
    res.json(healthPayload());
  });
  const localhostOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
    ...(process.env.VITE_APP_URL ? process.env.VITE_APP_URL.split(",") : []),
  ]
    .map(origin => origin.trim())
    .filter(Boolean);

  app.use(securityHeaders);

  const isOriginAllowed = (
    origin: string | undefined,
    requestHost: string | undefined
  ): boolean => {
    if (!origin) return true;
    if (!ENV.isProduction && localhostOriginRegex.test(origin)) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (requestHost) {
      try {
        if (new URL(origin).host === requestHost) return true;
      } catch {
        // ignore malformed origin
      }
    }
    if (!ENV.isProduction && allowedOrigins.length === 0) return true;
    return false;
  };

  // CORS solo en /api — el middleware global rompía assets con atributo crossorigin.
  app.use("/api", (req, res, next) => {
    const corsOptions: CorsOptions = {
      origin(origin, callback) {
        if (ENV.isProduction && allowedOrigins.length === 0 && !origin) {
          callback(new Error("CORS blocked: configure FRONTEND_URL or VITE_APP_URL"));
          return;
        }
        if (isOriginAllowed(origin, req.get("host") ?? undefined)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    };
    cors(corsOptions)(req, res, next);
  });

  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const signature = req.headers["stripe-signature"];
        if (!signature || typeof signature !== "string") {
          res.status(400).send("Missing stripe-signature");
          return;
        }
        const { verifyStripeWebhook, handleStripeWebhookEvent } = await import("./stripe.js");
        const event = verifyStripeWebhook(req.body as Buffer, signature);
        await handleStripeWebhookEvent(event);
        res.json({ received: true });
      } catch (error) {
        console.error("Stripe webhook error:", error);
        res.status(400).send("Webhook error");
      }
    }
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.get("/api/cron/notifications", async (req, res) => {
    if (!isCronAuthorized(req, res)) return;
    try {
      await checkAndSendNotifications({ timeZone: "Europe/Madrid", leadMinutes: 1 });
      res.json({ ok: true });
    } catch (error) {
      console.error("Cron notifications error:", error);
      res.status(500).json({ ok: false, error: "Failed to run notifications" });
    }
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = ENV.isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (!ENV.isProduction && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    if (ENV.isProduction) {
      console.log(
        `[cron] Interno: ${isInternalCronEnabled() ? "activo (CRON_INTERNAL=true)" : "desactivado — usa GET /api/cron/notifications?secret=CRON_SECRET"}`
      );
    }
  });

  if (isInternalCronEnabled()) {
    setInterval(() => {
      checkAndSendNotifications({ timeZone: "Europe/Madrid", leadMinutes: 1 }).catch((error) => {
        console.error("Error in notification scheduler:", error);
      });
    }, 60000);

    checkAndSendNotifications({ timeZone: "Europe/Madrid", leadMinutes: 1 }).catch((error) => {
      console.error("Error in initial notification check:", error);
    });
  }
}

startServer().catch(console.error);
