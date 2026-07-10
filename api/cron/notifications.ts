import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkAndSendNotifications } from "../../server/notificationService";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.authorization;
  const customHeaderSecret = req.headers["x-cron-secret"];
  const isVercelCron = Boolean(req.headers["x-vercel-cron"]);

  if (isProduction && !secret) {
    return res.status(503).json({ error: "Cron not configured" });
  }

  if (secret) {
    const authorizedByBearer = authHeader === `Bearer ${secret}`;
    const authorizedByCustomHeader = customHeaderSecret === secret;
    const authorizedByQuery = req.query.secret === secret;
    if (!isVercelCron && !authorizedByBearer && !authorizedByCustomHeader && !authorizedByQuery) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    await checkAndSendNotifications({ timeZone: "Europe/Madrid", leadMinutes: 1 });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Cron notifications error:", error);
    return res.status(500).json({ error: "Failed to run notifications" });
  }
}
