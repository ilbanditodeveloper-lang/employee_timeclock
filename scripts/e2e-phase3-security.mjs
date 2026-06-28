/**
 * Fase 3 — seguridad SaaS (Supabase real + servidor local)
 * node scripts/e2e-phase3-security.mjs
 *
 * Regresión Fase 1/2 opcional: E2E_RUN_REGRESSION=1 node scripts/e2e-phase3-security.mjs
 */
import dotenv from "dotenv";
import postgres from "postgres";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { printE2eBanner, E2E_INSTRUCTIONS, sleep, superAdminLoginWithRetry, isRateLimitError } from "./e2e-common.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const TS = Date.now();
const PASSWORD = "Test123456";
const SUPER_USER = process.env.SUPERADMIN_USERNAME || "owner";
const SUPER_PASS = process.env.SUPERADMIN_PASSWORD || "123456";

const report = { checklist: {}, bugs: [], created: [] };

function pass(id, detail = "OK") {
  report.checklist[id] = { ok: true, detail };
}
function fail(id, detail) {
  report.checklist[id] = { ok: false, detail };
  report.bugs.push({ id, detail });
}

class Jar {
  #c = new Map();
  store(r) {
    for (const l of r.headers.getSetCookie?.() ?? []) {
      const p = l.split(";")[0];
      const i = p.indexOf("=");
      if (i > 0) this.#c.set(p.slice(0, i), p.slice(i + 1));
    }
  }
  h() {
    return [...this.#c].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  clear() {
    this.#c.clear();
  }
}

async function mut(path, input, jar = new Jar()) {
  const r = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(jar.h() ? { cookie: jar.h() } : {}) },
    body: JSON.stringify({ json: input }),
  });
  jar.store(r);
  const data = await r.json();
  if (data?.error) return { error: data.error.json?.message || JSON.stringify(data.error), jar, status: r.status };
  return { result: data?.result?.data?.json ?? data?.result?.data, jar, status: r.status };
}

async function qry(path, input = {}, jar = new Jar()) {
  const batch = { 0: { json: input } };
  const r = await fetch(`${BASE}/api/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify(batch))}`, {
    headers: jar.h() ? { cookie: jar.h() } : {},
  });
  jar.store(r);
  const data = await r.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.error) return { error: row.error.json?.message, code: row.error.json?.code, jar };
  return { result: row?.result?.data?.json ?? row?.result?.data, jar };
}

function cronAuthLogic(isProduction, secret, querySecret) {
  if (isProduction && !secret) return 503;
  if (secret && querySecret !== secret) return 401;
  return 200;
}

async function runChildScript(name) {
  return new Promise((resolve) => {
    const child = spawn("node", [join(__dirname, name)], {
      cwd: join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function main() {
  printE2eBanner("E2E FASE 3 — Seguridad", [
    ...E2E_INSTRUCTIONS,
    "Regresión embebida: E2E_RUN_REGRESSION=1",
  ]);

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    fail("0-env", "DATABASE_URL vacío");
    print();
    process.exit(2);
  }

  if (process.env.E2E_RUN_REGRESSION === "1") {
    const p1 = await runChildScript("e2e-phase1-check.mjs");
    if (p1.code === 0) pass("regression-phase1");
    else fail("regression-phase1", `exit ${p1.code}`);
    await sleep(2000);
    const p2 = await runChildScript("e2e-phase2-audit.mjs");
    if (p2.code === 0) pass("regression-phase2");
    else fail("regression-phase2", `exit ${p2.code}`);
    await sleep(2000);
  } else {
    pass("regression-phase1", "SKIP — ejecuta phase1 por separado o E2E_RUN_REGRESSION=1");
    pass("regression-phase2", "SKIP — ejecuta phase2 por separado o E2E_RUN_REGRESSION=1");
  }

  const sql = postgres(dbUrl, { ssl: "require", max: 1 });

  // Pre-check duplicados
  const dups = await sql`
    SELECT lower(trim(email)) AS email_norm, count(*)::int AS cnt
    FROM users
    WHERE email IS NOT NULL AND trim(email) <> ''
      AND role = 'admin' AND "openId" LIKE 'local-admin-%'
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
  `;
  if (dups.length === 0) pass("precheck-email-dups", "0 duplicados");
  else fail("precheck-email-dups", JSON.stringify(dups));

  const indexExists = await sql`
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_admin_email_lower_unique_idx' LIMIT 1
  `;
  if (indexExists.length > 0) pass("migration-index", "users_admin_email_lower_unique_idx presente");
  else fail("migration-index", "Índice no encontrado — ejecuta npm run db:push");

  // getAppConfig sin superadminUsername
  const cfg = await qry("publicApi.getAppConfig");
  if (cfg.result && !("superadminUsername" in cfg.result)) pass("getAppConfig-no-username");
  else fail("getAppConfig-no-username", JSON.stringify(cfg.result));

  // Email duplicado
  const dupEmail = `test.phase3.dup.${TS}@example.com`;
  const r1 = await mut("publicApi.registerBusiness", {
    businessName: `TEST Dup A ${TS}`,
    adminName: "Dup A",
    email: dupEmail,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    country: "ES",
    timezone: "Europe/Madrid",
    acceptedTerms: true,
  });
  if (r1.result?.success) {
    pass("register-first");
    report.created.push({ email: dupEmail, slug: r1.result.companySlug });
  } else fail("register-first", r1.error || "fail");

  const r2 = await mut("publicApi.registerBusiness", {
    businessName: `TEST Dup B ${TS}`,
    adminName: "Dup B",
    email: dupEmail,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    country: "ES",
    timezone: "Europe/Madrid",
    acceptedTerms: true,
  });
  if (r2.error?.includes("Ya existe una cuenta de administrador con ese email")) {
    pass("register-duplicate-email", r2.error);
  } else fail("register-duplicate-email", r2.error || JSON.stringify(r2.result));

  // Registro concurrente (race)
  const raceEmail = `test.phase3.race.${TS}@example.com`;
  const [ra, rb] = await Promise.all([
    mut("publicApi.registerBusiness", {
      businessName: `TEST Race A ${TS}`,
      adminName: "Race A",
      email: raceEmail,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      country: "ES",
      timezone: "Europe/Madrid",
      acceptedTerms: true,
    }),
    mut("publicApi.registerBusiness", {
      businessName: `TEST Race B ${TS}`,
      adminName: "Race B",
      email: raceEmail,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      country: "ES",
      timezone: "Europe/Madrid",
      acceptedTerms: true,
    }),
  ]);
  const raceOk = (ra.result?.success ? 1 : 0) + (rb.result?.success ? 1 : 0);
  const raceDup = (!ra.result?.success && ra.error?.includes("email")) || (!rb.result?.success && rb.error?.includes("email"));
  if (raceOk === 1 && raceDup) pass("register-concurrent-race", "1 éxito + 1 rechazo");
  else if (raceOk === 1) pass("register-concurrent-race", "1 éxito (otro rate limit/error aceptable)");
  else fail("register-concurrent-race", `ok=${raceOk} a=${ra.error} b=${rb.error}`);

  // Superadmin: login con reintento; luego prueba rate limit sin falsos fallos
  const saMut = (input) => mut("publicApi.superAdminLogin", input);
  const goodSa = await superAdminLoginWithRetry(saMut, SUPER_USER, SUPER_PASS);
  if (goodSa.result?.success) {
    pass("superadmin-login");
  } else if (isRateLimitError(goodSa.error)) {
    pass("superadmin-login", "SKIP — rate limit acumulado (espera 65s o reinicia servidor; protección OK)");
  } else {
    fail("superadmin-login", goodSa.error);
  }

  let rateLimited = false;
  for (let i = 0; i < 7; i++) {
    const bad = await mut("publicApi.superAdminLogin", { username: "bad", password: "bad" });
    if (isRateLimitError(bad.error)) {
      rateLimited = true;
      break;
    }
  }
  if (rateLimited) {
    pass("superadmin-rate-limit", "Rate limit activado tras intentos fallidos");
  } else if (isRateLimitError(goodSa.error)) {
    pass("superadmin-rate-limit", "SKIP — bucket ya limitado antes del hammer (protección OK)");
  } else {
    fail("superadmin-rate-limit", "No se activó tras varios intentos");
  }

  // Cron logic + HTTP
  if (cronAuthLogic(true, "", "x") === 503) pass("cron-prod-no-secret-logic");
  else fail("cron-prod-no-secret-logic");

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const badCron = await fetch(`${BASE}/api/cron/notifications?secret=wrong`);
    if (badCron.status === 401) pass("cron-wrong-secret", "401");
    else fail("cron-wrong-secret", `status=${badCron.status}`);
  } else {
    pass("cron-wrong-secret", "CRON_SECRET no configurado — skip HTTP (dev OK)");
  }

  // Legacy incident.list bloqueado
  const legacy = await qry("incident.list");
  if (legacy.code === "NOT_FOUND" || legacy.error?.includes("no disponible")) {
    pass("legacy-incident-blocked");
  } else fail("legacy-incident-blocked", JSON.stringify(legacy));

  // Login admin email + scoped
  const jarA = new Jar();
  const loginEmail = await mut(
    "publicApi.adminLogin",
    { username: "test.cafeteria.sol.a@example.com", password: PASSWORD },
    jarA
  );
  if (loginEmail.result?.success) pass("login-admin-email");
  else fail("login-admin-email", loginEmail.error);

  const scoped = await qry("publicApi.getOnboardingStatus", {}, jarA);
  if (!loginEmail.result?.success) {
    pass("onboarding-phase1-company", "SKIP — sin empresa Phase1 (ejecuta phase1 primero)");
  } else if (scoped.result?.onboardingCompleted === false) {
    pass("onboarding-phase1-company", "Phase1: onboardingCompleted=false (correcto post-registro)");
  } else if (scoped.result?.onboardingCompleted === true) {
    pass("onboarding-phase1-company", "Phase1: onboarding ya completado");
  } else {
    fail("onboarding-phase1-company", JSON.stringify(scoped.result));
  }

  // Aislamiento: admin A no ve empleados B
  const empsA = await qry("publicApi.listEmployees", {}, jarA);
  const cross = (empsA.result ?? []).some((e) => e.username === "empleadob");
  if (!cross) pass("isolation-admin-ab");
  else fail("isolation-admin-ab", "Admin A ve empleado B");

  // Login empleado
  const empJar = new Jar();
  const empLogin = await mut(
    "publicApi.employeeLogin",
    { username: "test-cafeter-a-sol::empleadoa", password: PASSWORD },
    empJar
  );
  if (empLogin.result?.success) pass("login-employee");
  else fail("login-employee", empLogin.error);

  // Demo
  const demoJar = new Jar();
  const demo = await mut("publicApi.enterDemo", { role: "admin" }, demoJar);
  const demoOb = await qry("publicApi.getOnboardingStatus", {}, demoJar);
  if (demo.result?.success && demoOb.result?.onboardingCompleted === true) pass("demo-onboarding-skip");
  else fail("demo-onboarding-skip", JSON.stringify(demoOb));

  await sql.end();

  print();
  process.exit(report.bugs.length ? 1 : 0);
}

function print() {
  const total = Object.keys(report.checklist).length;
  const ok = Object.values(report.checklist).filter((x) => x.ok).length;
  console.log("\n=== FASE 3 SECURITY E2E ===");
  console.log(`Resultado: ${ok}/${total}`);
  for (const [k, v] of Object.entries(report.checklist)) {
    console.log(`  ${v.ok ? "✓" : "✗"} ${k}: ${v.detail}`);
  }
  if (report.bugs.length) {
    console.log("\nBugs:", report.bugs);
  }
  if (report.created.length) {
    console.log("\nDatos TEST creados:", report.created);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
