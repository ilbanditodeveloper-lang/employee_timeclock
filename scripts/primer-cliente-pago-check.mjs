/**
 * Checklist automatizado — primer cliente de pago.
 *
 * Uso (producción remota + env local con DATABASE_URL):
 *   node scripts/primer-cliente-pago-check.mjs --url=https://timeclockapp.es --production
 *
 * Solo HTTP (sin BD):
 *   node scripts/primer-cliente-pago-check.mjs --url=https://timeclockapp.es
 *
 * Piloto sin Stripe (cobro manual en superadmin):
 *   node scripts/primer-cliente-pago-check.mjs --url=https://timeclockapp.es --production --piloto
 */
import dotenv from "dotenv";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.staging.local") });
dotenv.config({ path: join(__dirname, "..", ".env.local") });
dotenv.config({ path: join(__dirname, "..", ".env") });

const urlArg = process.argv.find((a) => a.startsWith("--url="));
const BASE = urlArg?.slice(6) || process.env.FRONTEND_URL || process.env.VITE_APP_URL || "https://timeclockapp.es";
const isProduction = process.argv.includes("--production");
const isPilot = process.argv.includes("--piloto");

const ITEMS = [
  { id: "01-health", label: "Servidor responde /healthz" },
  { id: "02-legal-public", label: "Páginas legales públicas (/legal/*)" },
  { id: "03-app-config", label: "getAppConfig sin fugas (superadmin)" },
  { id: "04-cron-protected", label: "Cron notificaciones protegido" },
  { id: "05-vapid", label: "VAPID configurado (push fichaje)" },
  { id: "06-stripe", label: "Stripe configurado (cobro automático)" },
  { id: "07-env-secrets", label: "Secretos producción (JWT, CRON, superadmin)" },
  { id: "08-demo-off", label: "DEMO_MODE desactivado" },
  { id: "09-db-schema", label: "BD migrada (0015+ legal compliance)" },
  { id: "10-test-data", label: "Sin datos TEST en producción" },
];

const report = { ok: true, baseUrl: BASE.replace(/\/$/, ""), items: [] };

function item(id, ok, detail, action = "") {
  report.items.push({ id, ok, detail, action });
  if (!ok) report.ok = false;
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${report.baseUrl}${path}`, {
    signal: AbortSignal.timeout(15000),
    ...opts,
  });
  return res;
}

async function trpcQuery(procedure, input = null) {
  const batch = encodeURIComponent(JSON.stringify({ 0: { json: input } }));
  const res = await fetch(`${report.baseUrl}/api/trpc/${procedure}?batch=1&input=${batch}`);
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.error) return { error: row.error?.json?.message ?? "tRPC error" };
  return { data: row?.result?.data?.json ?? row?.result?.data };
}

async function runChild(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(__dirname, script), ...args], {
      cwd: join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function main() {
  console.log("\n=== CHECKLIST PRIMER CLIENTE DE PAGO ===");
  console.log(`URL: ${report.baseUrl}\n`);

  // 01 health
  try {
    const res = await fetchJson("/healthz");
    if (res.ok) {
      const body = await res.json();
      if (body.ok && !body.databaseUrl) item("01-health", true, "OK");
      else item("01-health", false, "Respuesta inválida", "Revisar servidor Node en Render");
    } else {
      item("01-health", false, `HTTP ${res.status}`, "Verificar deploy en Render");
    }
  } catch (e) {
    item("01-health", false, e instanceof Error ? e.message : String(e), "Servidor caído o URL incorrecta");
  }

  // 02 legal
  let legalOk = true;
  for (const path of ["/legal/privacy", "/legal/terms", "/legal/dpa"]) {
    try {
      const r = await fetchJson(path);
      if (!r.ok) legalOk = false;
    } catch {
      legalOk = false;
    }
  }
  item(
    "02-legal-public",
    legalOk,
    legalOk ? "3/3 páginas OK" : "Alguna página legal falla",
    "Abrir https://timeclockapp.es/legal/terms en navegador"
  );

  // 03 app config
  const cfg = await trpcQuery("publicApi.getAppConfig");
  if (cfg.data && cfg.data.registrationAvailable !== undefined && !("superadminUsername" in cfg.data)) {
    item("03-app-config", true, `registrationAvailable=${cfg.data.registrationAvailable}`);
  } else {
    item("03-app-config", false, cfg.error ?? "config inválida", "Revisar API /api/trpc");
  }

  // 04 cron
  try {
    const bad = await fetchJson("/api/cron/notifications?secret=wrong");
    if (bad.status === 401 || bad.status === 503) {
      item("04-cron-protected", true, `HTTP ${bad.status} (correcto)`);
    } else {
      item("04-cron-protected", false, `HTTP ${bad.status}`, "Configurar CRON_SECRET en Render");
    }
  } catch {
    item("04-cron-protected", false, "No alcanzable", "Verificar ruta /api/cron/notifications");
  }

  // 05 vapid
  const vapid = await trpcQuery("publicApi.pushNotifications.getVapidPublicKey");
  const vapidKey = vapid.data?.publicKey?.trim();
  if (vapidKey) item("05-vapid", true, "Clave pública disponible");
  else {
    item(
      "05-vapid",
      false,
      "Sin VAPID",
      "Render: VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (node scripts/generate-vapid-keys.js)"
    );
  }

  // 06 stripe
  const stripeEnabled = Boolean(cfg.data?.stripe?.enabled);
  if (stripeEnabled) item("06-stripe", true, "Stripe activo en servidor");
  else if (isPilot) {
    item(
      "06-stripe",
      true,
      "Stripe no configurado — OK en modo piloto (activar plan en superadmin)",
      "Para cobro automático: docs/STRIPE_AND_NATIVE_SETUP.md"
    );
  } else {
    item(
      "06-stripe",
      false,
      "Stripe no configurado",
      "Render: STRIPE_SECRET_KEY… o añade --piloto si cobras manualmente"
    );
  }

  // 07 env (local check — needs .env with prod values)
  if (isProduction) {
    const jwtOk = (process.env.JWT_SECRET?.length ?? 0) >= 32;
    const cronOk = Boolean(process.env.CRON_SECRET?.trim());
    const superOk = Boolean(process.env.SUPERADMIN_PASSWORD?.trim()) && process.env.SUPERADMIN_PASSWORD !== "123456";
    const envOk = jwtOk && cronOk && superOk;
    item(
      "07-env-secrets",
      envOk,
      envOk ? "JWT + CRON + superadmin OK" : `jwt=${jwtOk} cron=${cronOk} superadmin=${superOk}`,
      "Completar variables en Render Dashboard → Environment"
    );
  } else {
    item("07-env-secrets", true, "SKIP — añade --production con .env de prod");
  }

  // 08 demo
  if (isProduction) {
    const demoOff = process.env.DEMO_MODE !== "true";
    item(
      "08-demo-off",
      demoOff,
      demoOff ? "DEMO_MODE no activo" : "DEMO_MODE=true en prod",
      "Render: DEMO_MODE=false o eliminar variable"
    );
  } else {
    item("08-demo-off", true, "SKIP — añade --production");
  }

  // 09-10 DB
  if (process.env.DATABASE_URL?.trim()) {
    const verify = await runChild("verify-production-db.mjs", isProduction ? ["--production"] : []);
    const dbOk = verify.code === 0;
    try {
      const parsed = JSON.parse(verify.out.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      const hasLegal = parsed.checks?.some((c) => c.id === "schema-employees-contractType" && c.ok);
      item(
        "09-db-schema",
        dbOk && (hasLegal !== false),
        dbOk ? "verify-production-db PASS" : "verify-production-db FAIL",
        "Ejecutar: npm run db:migrate en servidor o local con DATABASE_URL de prod"
      );
      const testFail = parsed.checks?.find((c) => c.id === "test-data" && !c.ok);
      item(
        "10-test-data",
        !testFail,
        testFail ? testFail.detail : "Sin datos TEST",
        "node scripts/cleanup-test-data.mjs si hay datos de prueba"
      );
    } catch {
      item("09-db-schema", dbOk, dbOk ? "PASS" : `exit ${verify.code}`, "npm run verify:db:prod");
      item("10-test-data", dbOk, "Ver salida verify-production-db", "node scripts/inventory-test-data.mjs");
    }
  } else {
    item("09-db-schema", false, "DATABASE_URL no en entorno local", "Copiar DATABASE_URL de Render a .env.local");
    item("10-test-data", false, "SKIP sin DATABASE_URL", "node scripts/inventory-test-data.mjs");
  }

  const passed = report.items.filter((i) => i.ok).length;
  console.log(`Resultado: ${report.ok ? (isPilot ? "LISTO PILOTO" : "LISTO") : "PENDIENTE"} (${passed}/${ITEMS.length})\n`);
  for (const row of report.items) {
    const label = ITEMS.find((x) => x.id === row.id)?.label ?? row.id;
    console.log(`${row.ok ? "✓" : "✗"} ${label}`);
    console.log(`    ${row.detail}`);
    if (!row.ok && row.action) console.log(`    → ${row.action}`);
  }
  console.log("\nManual obligatorio: docs/CHECKLIST_PRIMER_CLIENTE_PAGO_ES.md (secciones A–E)\n");
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
