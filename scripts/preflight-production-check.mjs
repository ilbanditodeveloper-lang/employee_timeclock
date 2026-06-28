/**
 * Preflight pre-deploy producción.
 *
 * node scripts/preflight-production-check.mjs --production
 * node scripts/preflight-production-check.mjs --staging
 * node scripts/preflight-production-check.mjs --production --url=https://app.example.com
 */
import dotenv from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
dotenv.config({ path: join(__dirname, "..", ".env") });

const isProduction = process.argv.includes("--production");
const isStaging = process.argv.includes("--staging");
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const baseUrl = urlArg?.slice(6) || process.env.FRONTEND_URL || process.env.VITE_APP_URL || "http://localhost:3000";

const report = { ok: true, mode: isProduction ? "production" : isStaging ? "staging" : "local", checks: [] };

function pass(id, detail = "OK") {
  report.checks.push({ id, ok: true, detail });
}
function fail(id, detail) {
  report.ok = false;
  report.checks.push({ id, ok: false, detail });
}

const MIN_JWT = 32;

if (isProduction) {
  if (process.env.NODE_ENV !== "production") fail("NODE_ENV", `esperado production, got ${process.env.NODE_ENV ?? "undefined"}`);
  else pass("NODE_ENV");
} else {
  pass("NODE_ENV", process.env.NODE_ENV ?? "not set");
}

const requiredProd = [
  "DATABASE_URL",
  "JWT_SECRET",
  "CRON_SECRET",
  "SUPERADMIN_USERNAME",
  "SUPERADMIN_PASSWORD",
  "FRONTEND_URL",
  "VITE_APP_URL",
];

for (const key of requiredProd) {
  const val = process.env[key]?.trim();
  if (isProduction && !val) fail(`env-${key}`, "faltante");
  else if (val) pass(`env-${key}`);
  else pass(`env-${key}`, "SKIP");
}

if (isProduction && process.env.JWT_SECRET) {
  if (process.env.JWT_SECRET.length >= MIN_JWT) pass("JWT_SECRET-length");
  else fail("JWT_SECRET-length", `mínimo ${MIN_JWT} caracteres`);
}

if (isProduction && !process.env.CRON_SECRET?.trim()) fail("CRON_SECRET", "obligatorio");

if (isProduction && process.env.DEMO_MODE === "true") {
  fail("DEMO_MODE", "no permitido en producción");
} else {
  pass("DEMO_MODE", process.env.DEMO_MODE ?? "unset");
}

pass("CRON_INTERNAL", process.env.CRON_INTERNAL ?? (isProduction ? "default false" : "default true dev"));

const dbUrl = process.env.DATABASE_URL?.trim();
if (dbUrl) {
  const sql = postgres(dbUrl, { ssl: "require", max: 1, max_lifetime: 60 });
  try {
    await sql`SELECT 1`;
    pass("db-connect");

    const idx = await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'users_admin_email_lower_unique_idx'`;
    if (idx.length) pass("index-admin-email");
    else if (isProduction) fail("index-admin-email", "falta migración 0008");
    else pass("index-admin-email", "SKIP");

    const onboardingCol = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'onboardingCompleted'`;
    if (onboardingCol.length) pass("schema-onboarding");
    else if (isProduction) fail("schema-onboarding", "ejecuta db:migrate");
    else pass("schema-onboarding", "SKIP");

    const testCo = await sql`
      SELECT count(*)::int AS c FROM companies
      WHERE slug LIKE 'test-%' OR name LIKE 'TEST %' OR name LIKE 'TEST%'`;
    const testUs = await sql`SELECT count(*)::int AS c FROM users WHERE email LIKE '%@example.com'`;
    const tc = testCo[0]?.c ?? 0;
    const tu = testUs[0]?.c ?? 0;
    if (tc === 0 && tu === 0) pass("test-data", "limpio");
    else if (isProduction) fail("test-data", `${tc} TEST companies, ${tu} @example.com`);
    else pass("test-data", `WARN: ${tc} TEST / ${tu} @example.com`);

    const dupRow = await sql`
      SELECT count(*)::int AS c FROM (
        SELECT lower(trim(email)) FROM users
        WHERE email IS NOT NULL AND role = 'admin' AND "openId" LIKE 'local-admin-%'
        GROUP BY lower(trim(email)) HAVING count(*) > 1
      ) x`;
    if ((dupRow[0]?.c ?? 0) === 0) pass("admin-email-dups");
    else fail("admin-email-dups", `${dupRow[0].c} duplicados`);
  } catch (e) {
    fail("db-connect", e instanceof Error ? e.message : String(e));
  }
  await sql.end();
} else if (isProduction) {
  fail("DATABASE_URL", "faltante");
}

try {
  const health = await fetch(`${baseUrl.replace(/\/$/, "")}/healthz`, { signal: AbortSignal.timeout(10000) });
  if (health.ok) {
    const body = await health.json();
    if (body.ok === true && !body.databaseUrl) pass("healthz");
    else fail("healthz", "respuesta inválida o expone datos sensibles");
  } else {
    fail("healthz", `HTTP ${health.status}`);
  }
} catch {
  pass("healthz", "SKIP — servidor no alcanzable (normal si preflight sin deploy)");
}

try {
  const batch = encodeURIComponent(JSON.stringify({ 0: { json: null } }));
  const cfgRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/trpc/publicApi.getAppConfig?batch=1&input=${batch}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (cfgRes.ok) {
    const data = await cfgRes.json();
    const row = Array.isArray(data) ? data[0] : data;
    const result = row?.result?.data?.json ?? row?.result?.data;
    if (result && !("superadminUsername" in result)) pass("getAppConfig-safe");
    else fail("getAppConfig-safe", "expone superadmin");
  } else pass("getAppConfig-safe", "SKIP");
} catch {
  pass("getAppConfig-safe", "SKIP");
}

for (const path of ["/legal/privacy", "/legal/terms", "/legal/dpa"]) {
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { signal: AbortSignal.timeout(10000) });
    if (r.ok) pass(`legal${path}`);
    else fail(`legal${path}`, `HTTP ${r.status}`);
  } catch {
    pass(`legal${path}`, "SKIP");
  }
}

if (isProduction && process.env.CRON_SECRET) {
  try {
    const bad = await fetch(`${baseUrl.replace(/\/$/, "")}/api/cron/notifications?secret=wrong`, {
      signal: AbortSignal.timeout(10000),
    });
    if (bad.status === 401 || bad.status === 503) pass("cron-protected");
    else fail("cron-protected", `HTTP ${bad.status}`);
  } catch {
    pass("cron-protected", "SKIP");
  }
}

console.log("\n=== PREFLIGHT ===");
console.log(JSON.stringify(report, null, 2));
const ok = report.checks.filter((c) => c.ok).length;
console.log(`\nResultado: ${report.ok ? "PASS" : "FAIL"} (${ok}/${report.checks.length})`);
process.exit(report.ok ? 0 : 1);
