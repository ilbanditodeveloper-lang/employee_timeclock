/**
 * Dispara un deploy en Render vía Deploy Hook.
 *
 * 1. Render Dashboard → Web Service → Settings → Deploy Hook → copiar URL
 * 2. Añadir a .env.staging.local: RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-...
 * 3. node scripts/trigger-render-deploy.mjs
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.staging.local") });
dotenv.config({ path: join(__dirname, "..", ".env.local") });
dotenv.config({ path: join(__dirname, "..", ".env") });

const hook = process.env.RENDER_DEPLOY_HOOK_URL?.trim();
if (!hook) {
  console.error("Falta RENDER_DEPLOY_HOOK_URL en .env.staging.local");
  console.error("Render → employee-timeclock-1 → Settings → Deploy Hook");
  process.exit(1);
}

console.log("Disparando deploy en Render…");
const res = await fetch(hook, { method: "POST" });
const text = await res.text();
if (!res.ok) {
  console.error(`Error HTTP ${res.status}: ${text}`);
  process.exit(1);
}
console.log("Deploy iniciado:", text || "OK");
console.log("Espera 3–8 min y comprueba: npm run check:primer-cliente:http");
