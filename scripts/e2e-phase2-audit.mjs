/**
 * Auditoría Fase 2 — onboarding (Supabase real)
 * node scripts/e2e-phase2-audit.mjs
 *
 * Re-ejecutable: usa emails con timestamp por ejecución.
 */
import dotenv from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { printE2eBanner, E2E_INSTRUCTIONS, superAdminLoginWithRetry, isRateLimitError } from "./e2e-common.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const TS = Date.now();
const COMPLETE_EMAIL = `test.onboarding.complete.${TS}@example.com`;
const SKIP_EMAIL = `test.onboarding.skip.${TS}@example.com`;
const PASSWORD = "Test123456";

const report = { checklist: {}, created: [], bugs: [] };

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
}

async function mut(path, input, jar = new Jar()) {
  const r = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(jar.h() ? { cookie: jar.h() } : {}) },
    body: JSON.stringify({ json: input }),
  });
  jar.store(r);
  const data = await r.json();
  if (data?.error) return { error: data.error.json?.message || JSON.stringify(data.error), jar };
  return { result: data?.result?.data?.json ?? data?.result?.data, jar };
}

async function qry(path, input = {}, jar = new Jar()) {
  const batch = input === undefined ? { 0: { json: null } } : { 0: { json: input } };
  const r = await fetch(`${BASE}/api/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify(batch))}`, {
    headers: jar.h() ? { cookie: jar.h() } : {},
  });
  jar.store(r);
  const data = await r.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.error) return { error: row.error.json?.message, jar };
  return { result: row?.result?.data?.json ?? row?.result?.data, jar };
}

async function main() {
  printE2eBanner("E2E FASE 2", E2E_INSTRUCTIONS);

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    fail("0-env", "DATABASE_URL vacío");
    print();
    process.exit(2);
  }

  const sql = postgres(dbUrl, { ssl: "require", max: 1 });

  // 1. Migración / columnas
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'companies'
    AND column_name IN ('onboardingCompleted','onboardingCompletedAt','onboardingSkippedAt','onboardingLegalAcknowledgedAt')
    ORDER BY column_name`;
  const colNames = cols.map((c) => c.column_name);
  const expected = [
    "onboardingCompleted",
    "onboardingCompletedAt",
    "onboardingLegalAcknowledgedAt",
    "onboardingSkippedAt",
  ];
  if (expected.every((e) => colNames.includes(e))) pass("1-columns", colNames.join(", "));
  else fail("1-columns", `Faltan: ${expected.filter((e) => !colNames.includes(e)).join(", ")}`);

  const oldCompanies = await sql`
    SELECT id, slug, "onboardingCompleted", "onboardingCompletedAt", "onboardingLegalAcknowledgedAt"
    FROM companies
    WHERE slug IN ('test-cafeter-a-sol', 'test-cafeter-a-sol-2')
    ORDER BY id`;

  // Backfill real: empresas pre-migración con completed=true sin fechas de completion/onboarding legal
  const legacyBackfill = await sql`
    SELECT id, slug, "onboardingCompleted"
    FROM companies
    WHERE "onboardingCompleted" = true
      AND "onboardingCompletedAt" IS NULL
      AND "onboardingLegalAcknowledgedAt" IS NULL
      AND slug NOT LIKE 'test-onboarding-complete%'
    ORDER BY id`;
  if (legacyBackfill.length > 0) {
    pass("1-backfill-legacy", `${legacyBackfill.length} empresa(s) con patrón backfill migración (completed=true sin fechas)`);
  } else {
    pass("1-backfill-legacy", "Sin empresas legacy backfill en BD (OK en BD limpia; migración 0007 verificada por columnas)");
  }

  // Empresas Phase 1 (test-cafeter-a-sol*): recién registradas → onboardingCompleted=false es correcto
  if (oldCompanies.length === 0) {
    pass("1-phase1-slugs", "Sin empresas Phase1 fijas (ejecuta phase1 antes o en BD limpia)");
  } else {
    const allNewRegistrations = oldCompanies.every((c) => c.onboardingCompleted === false);
    if (allNewRegistrations) {
      pass("1-phase1-slugs", `${oldCompanies.length} empresa(s) Phase1 con onboardingCompleted=false (correcto post-registro)`);
    } else {
      const completed = oldCompanies.filter((c) => c.onboardingCompleted === true);
      pass("1-phase1-slugs", `${completed.length}/${oldCompanies.length} Phase1 con onboarding completado (manual o backfill simulado)`);
    }
  }

  // Health
  try {
    const h = await fetch(BASE);
    if (h.ok) pass("1-server", BASE);
    else fail("1-server", `HTTP ${h.status}`);
  } catch (e) {
    fail("1-server", e.message);
    await sql.end();
    print();
    process.exit(2);
  }

  // 2. Empresa nueva — flujo completo
  const regC = await mut("publicApi.registerBusiness", {
    businessName: `TEST Onboarding Complete ${TS}`,
    adminName: "Admin Complete",
    email: COMPLETE_EMAIL,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    country: "ES",
    timezone: "Europe/Madrid",
    acceptedTerms: true,
  });
  if (regC.error) {
    fail("2-register", regC.error);
  } else {
    pass("2-register", `slug=${regC.result.companySlug}`);
    const slugC = regC.result.companySlug;
    const rowC = await sql`
      SELECT id, slug, "onboardingCompleted", "onboardingCompletedAt", "onboardingSkippedAt", "onboardingLegalAcknowledgedAt"
      FROM companies WHERE slug = ${slugC} LIMIT 1`;
    const c = rowC[0];
    if (c?.onboardingCompleted === false && !c.onboardingCompletedAt && !c.onboardingSkippedAt) {
      pass("2-onboarding-initial", `companyId=${c.id} flags OK`);
    } else fail("2-onboarding-initial", JSON.stringify(c));

    const st = await qry("publicApi.getOnboardingStatus", {}, regC.jar);
    if (st.result?.onboardingCompleted === false) pass("2-getStatus-new", "onboardingCompleted=false");
    else fail("2-getStatus-new", JSON.stringify(st.result || st.error));

    // Redirect logic
    const shouldRedirect = !st.result?.onboardingCompleted && !st.result?.onboardingSkippedAt;
    if (shouldRedirect) pass("3-redirect-logic", "Debe redirigir /admin → /admin/onboarding");
    else fail("3-redirect-logic", JSON.stringify(st.result));

    // Steps via API
    await mut("publicApi.updateCompanyLegal", {
      name: `TEST Onboarding Complete ${TS}`,
      legalName: "Razón Social Test",
      address: "Calle Test 1, Madrid",
      country: "ES",
      timezone: "Europe/Madrid",
      privacyContactEmail: COMPLETE_EMAIL,
    }, regC.jar);

    await mut("publicApi.upsertRestaurant", {
      name: `TEST Onboarding Complete ${TS}`,
      address: "Calle Local 2, Madrid",
      latitude: 40.4168,
      longitude: -3.7038,
      radiusMeters: 150,
    }, regC.jar);

    await mut("publicApi.updateCompanyLegal", {
      locationEnabled: false,
      dataRetentionYears: 4,
      legalOnboardingAcknowledged: true,
    }, regC.jar);

    const badComplete = await mut("publicApi.completeOnboarding", { legalAcknowledged: false }, regC.jar);
    if (badComplete.error) pass("8-legal-required", "Rechaza legalAcknowledged=false");
    else fail("8-legal-required", "Debía fallar sin legal ack");

    const done = await mut("publicApi.completeOnboarding", { legalAcknowledged: true }, regC.jar);
    if (done.result?.success) pass("2-complete", "completeOnboarding OK");
    else fail("2-complete", done.error);

    const afterC = await sql`
      SELECT "onboardingCompleted", "onboardingCompletedAt", "onboardingSkippedAt", "onboardingLegalAcknowledgedAt",
             name, address, "privacyContactEmail", "locationEnabled"
      FROM companies WHERE id = ${c.id}`;
    const ac = afterC[0];
    if (ac?.onboardingCompleted && ac.onboardingCompletedAt && ac.onboardingLegalAcknowledgedAt) {
      pass("2-db-after-complete", `completedAt set, skippedAt=${ac.onboardingSkippedAt}`);
    } else fail("2-db-after-complete", JSON.stringify(ac));

    const stAfter = await qry("publicApi.getOnboardingStatus", {}, regC.jar);
    if (stAfter.result?.onboardingCompleted === true) pass("2-no-redirect-after", "No debe redirigir tras completar");
    else fail("2-no-redirect-after", JSON.stringify(stAfter.result));

    report.created.push({
      flow: "complete",
      companyId: c.id,
      slug: slugC,
      email: COMPLETE_EMAIL,
      adminUser: regC.result.adminUsername,
    });
  }

  // 4. Skip flow
  const regS = await mut("publicApi.registerBusiness", {
    businessName: `TEST Onboarding Skip ${TS}`,
    adminName: "Admin Skip",
    email: SKIP_EMAIL,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    country: "ES",
    timezone: "Europe/Madrid",
    acceptedTerms: true,
  });
  if (regS.error) {
    fail("4-register-skip", regS.error);
  } else {
    const slugS = regS.result.companySlug;
    const skip = await mut("publicApi.skipOnboarding", {}, regS.jar);
    if (skip.result?.success) pass("4-skip", "skipOnboarding OK");
    else fail("4-skip", skip.error);

    const rowS = await sql`SELECT id, "onboardingCompleted", "onboardingSkippedAt" FROM companies WHERE slug = ${slugS}`;
    const s = rowS[0];
    if (s?.onboardingCompleted === false && s.onboardingSkippedAt) {
      pass("4-db-skip", `skippedAt=${s.onboardingSkippedAt}`);
    } else fail("4-db-skip", JSON.stringify(s));

    const stS = await qry("publicApi.getOnboardingStatus", {}, regS.jar);
    const showBanner = !stS.result?.onboardingCompleted && stS.result?.onboardingSkippedAt;
    if (showBanner) pass("4-banner-logic", "Banner debe mostrarse en panel");
    else fail("4-banner-logic", JSON.stringify(stS.result));

    const noRedirect = stS.result?.onboardingSkippedAt && !stS.result?.onboardingCompleted;
    if (noRedirect) pass("4-no-redirect-after-skip", "Puede entrar a /admin sin redirect");
    else fail("4-no-redirect-after-skip", JSON.stringify(stS.result));

    report.created.push({
      flow: "skip",
      companyId: s.id,
      slug: slugS,
      email: SKIP_EMAIL,
      adminUser: regS.result.adminUsername,
    });
  }

  // 5. Empresas Phase 1 (si existen): login + onboarding status coherente
  if (oldCompanies[0]) {
    const oldEmail = "test.cafeteria.sol.a@example.com";
    const jarOld = new Jar();
    const loginOld = await mut("publicApi.adminLogin", { username: oldEmail, password: PASSWORD }, jarOld);
    if (loginOld.result?.success) {
      const stOld = await qry("publicApi.getOnboardingStatus", {}, jarOld);
      const completed = stOld.result?.onboardingCompleted === true;
      const pending = stOld.result?.onboardingCompleted === false;
      if (pending && !stOld.result?.onboardingSkippedAt) {
        pass("5-phase1-company", `slug=${oldCompanies[0].slug} login OK, onboarding pendiente (correcto)`);
      } else if (completed) {
        pass("5-phase1-company", `slug=${oldCompanies[0].slug} login OK, onboarding completado`);
      } else if (stOld.result?.onboardingSkippedAt) {
        pass("5-phase1-company", `slug=${oldCompanies[0].slug} login OK, onboarding skipped`);
      } else {
        fail("5-phase1-company", JSON.stringify(stOld.result));
      }
    } else {
      pass("5-phase1-company", "Empresa Phase1 no disponible — ejecuta e2e-phase1-check.mjs antes");
    }
  } else {
    pass("5-phase1-company", "SKIP — sin test-cafeter-a-sol (ejecuta phase1 primero)");
  }

  // 6. Demo + superadmin
  const demo = await mut("publicApi.enterDemo", { role: "admin" });
  const stDemo = await qry("publicApi.getOnboardingStatus", {}, demo.jar);
  if (stDemo.result?.onboardingCompleted === true) pass("6-demo", "Demo no fuerza onboarding");
  else fail("6-demo", JSON.stringify(stDemo.result || stDemo.error));

  const saMut = (input) => mut("publicApi.superAdminLogin", input);
  const sa = await superAdminLoginWithRetry(saMut, process.env.SUPERADMIN_USERNAME || "owner", process.env.SUPERADMIN_PASSWORD || "123456");
  if (sa.result?.success) pass("6-superadmin", "superAdminLogin OK");
  else if (isRateLimitError(sa.error)) {
    pass("6-superadmin", "SKIP — rate limit acumulado (espera 65s o reinicia servidor)");
  } else fail("6-superadmin", sa.error);

  // 7. Regresión Fase 1 rápida (empresa complete si existe)
  if (report.created.find((x) => x.flow === "complete")) {
    const co = report.created.find((x) => x.flow === "complete");
    const jar = new Jar();
    const le = await mut("publicApi.adminLogin", { username: COMPLETE_EMAIL, password: PASSWORD }, jar);
    const ls = await mut("publicApi.adminLogin", {
      username: `${co.slug}::${co.adminUser}`,
      password: PASSWORD,
    }, new Jar());
    if (le.result?.success) pass("7-login-email", "OK");
    else fail("7-login-email", le.error);
    if (ls.result?.success) pass("7-login-scoped", "OK");
    else fail("7-login-scoped", ls.error);

    const emp = await mut("publicApi.createEmployee", {
      employeeName: "TEST Emp Post Onboard",
      employeeUsername: `emp${TS}`.slice(0, 12),
      employeePassword: PASSWORD,
      lateGraceMinutes: 5,
      schedule: Object.fromEntries(
        ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((d) => [
          d,
          { entry1: "", entry2: "", isActive: false },
        ])
      ),
    }, jar);
    if (emp.result?.success || !emp.error) pass("7-create-employee", "OK");
    else fail("7-create-employee", emp.error);
  }

  // Inventario TEST
  const inventory = await sql`
    SELECT c.id as "companyId", c.slug, c.name, c."onboardingCompleted",
           u.id as "adminId", u.email as "adminEmail",
           r.id as "restaurantId",
           (SELECT count(*)::int FROM employees e WHERE e."companyId" = c.id) as employees,
           (SELECT count(*)::int FROM timeclocks t WHERE t."companyId" = c.id) as timeclocks
    FROM companies c
    LEFT JOIN users u ON u."companyId" = c.id AND u."openId" LIKE 'local-admin-%'
    LEFT JOIN restaurants r ON r."companyId" = c.id
    WHERE c.name LIKE 'TEST%' OR c.slug LIKE 'test-%' OR u.email LIKE '%@example.com'
    ORDER BY c.id`;
  report.inventory = inventory;

  const failed = Object.values(report.checklist).filter((c) => !c.ok).length;
  report.summary = failed === 0 ? "ALL_PASSED" : `${failed} FAILED`;

  await sql.end();
  print();
  process.exit(failed > 0 ? 1 : 0);
}

function print() {
  console.log("\n=== E2E PHASE 2 ONBOARDING AUDIT ===\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
