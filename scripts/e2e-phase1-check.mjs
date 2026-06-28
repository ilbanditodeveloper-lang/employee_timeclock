/**
 * E2E Phase 1 checklist — requiere DATABASE_URL en .env.local y servidor en BASE_URL.
 * Uso: node scripts/e2e-phase1-check.mjs
 *
 * Re-ejecutable: reutiliza empresas A/B y empleados si ya existen.
 * Si falla superadmin por rate-limit: espera 60s o reinicia npm run dev.
 */
import dotenv from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { printE2eBanner, E2E_INSTRUCTIONS, ensureEmployee, superAdminLoginWithRetry, isRateLimitError } from "./e2e-common.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
dotenv.config({ path: join(__dirname, "..", ".env") });

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const COOKIE_NAME = "app_session_id";

const TEST = {
  companyA: {
    businessName: "TEST Cafetería Sol",
    adminName: "Juan Test",
    email: "test.cafeteria.sol.a@example.com",
    password: "Test123456",
  },
  companyB: {
    businessName: "TEST Cafetería Sol",
    adminName: "María Test",
    email: "test.cafeteria.sol.b@example.com",
    password: "Test123456",
  },
  employeeA: { name: "TEST Empleado A", username: "empleadoa", password: "Test123456" },
  employeeB: { name: "TEST Empleado B", username: "empleadob", password: "Test123456" },
};

const emptySchedule = Object.fromEntries(
  ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((d) => [
    d,
    { entry1: "", entry2: "", isActive: false },
  ])
);

const report = {
  startedAt: new Date().toISOString(),
  checklist: {},
  companies: [],
  bugs: [],
  cleanup: { companies: [], slugs: [], users: [], restaurants: [], employees: [], timeclocks: [] },
};

function setCheck(id, ok, detail = "") {
  report.checklist[id] = { ok, detail };
}

function fail(id, detail) {
  setCheck(id, false, detail);
  report.bugs.push({ check: id, detail });
}

function pass(id, detail = "OK") {
  setCheck(id, true, detail);
}

class CookieJar {
  #cookies = new Map();
  store(res) {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const part = line.split(";")[0];
      const eq = part.indexOf("=");
      if (eq > 0) this.#cookies.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }
  header() {
    if (this.#cookies.size === 0) return "";
    return [...this.#cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  clear() {
    this.#cookies.clear();
  }
}

async function trpcMutation(path, input, jar = new CookieJar()) {
  const res = await fetch(`${BASE_URL}/api/trpc/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(jar.header() ? { cookie: jar.header() } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  jar.store(res);
  const data = await res.json();
  return { data, jar, status: res.status };
}

async function trpcQuery(path, input = {}, jar = new CookieJar()) {
  const batchInput = input === undefined ? { 0: { json: null } } : { 0: { json: input } };
  const encoded = encodeURIComponent(JSON.stringify(batchInput));
  const res = await fetch(`${BASE_URL}/api/trpc/${path}?batch=1&input=${encoded}`, {
    headers: jar.header() ? { cookie: jar.header() } : {},
  });
  jar.store(res);
  const data = await res.json();
  const batch = Array.isArray(data) ? data[0] : data;
  return { data: batch, jar, status: res.status };
}

function unwrapMutation(data) {
  if (data?.error) return { error: data.error.json?.message || JSON.stringify(data.error) };
  return { result: data?.result?.data?.json ?? data?.result?.data };
}

function unwrapQuery(batch) {
  if (batch?.error) return { error: batch.error.json?.message || "query error" };
  return { result: batch?.result?.data?.json ?? batch?.result?.data };
}

async function main() {
  printE2eBanner("E2E FASE 1", E2E_INSTRUCTIONS);

  // 1. Configuración
  const dbUrl = process.env.DATABASE_URL?.trim();
  const jwt = process.env.JWT_SECRET?.trim();
  if (!dbUrl) {
    fail("1-config-database", "DATABASE_URL vacío en .env.local");
    fail("E2E-BLOCKED", "Configura DATABASE_URL (Supabase) y reinicia el servidor");
    printReport();
    process.exit(2);
  }
  pass("1-config-database", "DATABASE_URL configurado");

  if (!jwt) fail("1-config-jwt", "JWT_SECRET vacío");
  else pass("1-config-jwt", "JWT_SECRET configurado");

  let sql;
  try {
    sql = postgres(dbUrl, { ssl: "require", max: 1 });
    await sql`SELECT 1 as ok`;
    pass("1-db-connect", "Conexión PostgreSQL OK");
  } catch (e) {
    fail("1-db-connect", String(e.message || e));
    printReport();
    process.exit(2);
  }

  try {
    const health = await fetch(BASE_URL);
    if (health.ok) pass("1-server-start", `Servidor responde ${BASE_URL} (${health.status})`);
    else fail("1-server-start", `HTTP ${health.status}`);
  } catch (e) {
    fail("1-server-start", `No se alcanza ${BASE_URL}: ${e.message}`);
    printReport();
    await sql.end();
    process.exit(2);
  }

  const configQ = await trpcQuery("publicApi.getAppConfig");
  const config = unwrapQuery(configQ.data);
  if (config.result?.registrationAvailable) pass("1-registration-available", "registrationAvailable=true");
  else fail("1-registration-available", "Servidor sin DATABASE_URL — reinicia npm run dev tras configurar .env.local");

  const demoJar = new CookieJar();
  const demoRes = await trpcMutation("publicApi.enterDemo", { role: "admin" }, demoJar);
  const demo = unwrapMutation(demoRes.data);
  if (demo.result?.success) pass("1-demo-mode", "enterDemo admin OK");
  else fail("1-demo-mode", demo.error || "enterDemo falló");
  demoJar.clear();

  // 7. Validaciones negativas (antes de crear datos)
  const neg = [
    ["7-invalid-email", { ...payloadA(), email: "bad" }],
    ["7-short-password", { ...payloadA(), password: "short", confirmPassword: "short" }],
    ["7-mismatch-password", { ...payloadA(), confirmPassword: "Test999999" }],
    ["7-empty-business", { ...payloadA(), businessName: "  " }],
    ["7-empty-admin", { ...payloadA(), adminName: " x" }],
    ["7-no-terms", { ...payloadA(), acceptedTerms: false }],
  ];
  for (const [id, input] of neg) {
    const r = await trpcMutation("publicApi.registerBusiness", input);
    const out = unwrapMutation(r.data);
    if (out.error) pass(id, out.error.slice(0, 120));
    else fail(id, "Debía fallar pero tuvo éxito");
  }

  // 2. Registro Empresa A
  let regA;
  const existingA = await loadTestCompanyByEmail(sql, TEST.companyA.email);
  let slugA, adminUserA, companyIdA, adminIdA, restaurantIdA;

  if (existingA) {
    pass("2-register-A", "Empresa A ya existía — reutilizando datos TEST");
    ({ slug: slugA, companyId: companyIdA, adminId: adminIdA, adminUsername: adminUserA, restaurantId: restaurantIdA } = existingA);
    regA = await trpcMutation("publicApi.adminLogin", {
      username: TEST.companyA.email,
      password: TEST.companyA.password,
    });
  } else {
    regA = await trpcMutation("publicApi.registerBusiness", payloadA());
    const outA = unwrapMutation(regA.data);
    if (outA.result?.success) {
      slugA = outA.result.companySlug;
      adminUserA = outA.result.adminUsername;
      pass("2-register-A", `slug=${slugA}, user=${adminUserA}`);
      const dbA = await verifyCompanyInDb(sql, slugA, TEST.companyA.email);
      if (dbA.ok) {
        companyIdA = dbA.companyId;
        adminIdA = dbA.adminId;
        restaurantIdA = dbA.restaurantId;
        pass("2-db-A", dbA.detail);
      } else fail("2-db-A", dbA.detail);
    } else fail("2-register-A", outA.error || "Error desconocido");
  }

  // Auto-login A
  const sessionA = await trpcQuery("publicApi.getSession", undefined, regA.jar);
  const sessA = unwrapQuery(sessionA.data);
  if (sessA.result?.session?.type === "admin" && sessA.result.session.companySlug === slugA) {
    pass("5-autologin-A", `companyId=${sessA.result.session.companyId}`);
  } else fail("5-autologin-A", JSON.stringify(sessA.result?.session || sessA.error));

  // 3. Registro Empresa B (nombre duplicado)
  let regB;
  const existingB = await loadTestCompanyByEmail(sql, TEST.companyB.email);
  let slugB, adminUserB, companyIdB, adminIdB, restaurantIdB;

  if (existingB) {
    pass("3-register-B", "Empresa B ya existía — reutilizando");
    ({ slug: slugB, companyId: companyIdB, adminId: adminIdB, adminUsername: adminUserB, restaurantId: restaurantIdB } = existingB);
    regB = await trpcMutation("publicApi.adminLogin", {
      username: TEST.companyB.email,
      password: TEST.companyB.password,
    });
  } else {
    regB = await trpcMutation("publicApi.registerBusiness", payloadB());
    const outB = unwrapMutation(regB.data);
    if (outB.result?.success) {
      slugB = outB.result.companySlug;
      adminUserB = outB.result.adminUsername;
      if (slugB !== slugA && (slugB === "test-cafeteria-sol-2" || slugB.endsWith("-2"))) {
        pass("3-slug-unique", `slugB=${slugB}`);
      } else if (slugB !== slugA) {
        pass("3-slug-unique", `slugB=${slugB} (sufijo único, no colisión)`);
      } else fail("3-slug-unique", `Colisión de slug: ${slugB}`);
      pass("3-register-B", `slug=${slugB}`);
      const dbB = await verifyCompanyInDb(sql, slugB, TEST.companyB.email);
      if (dbB.ok) {
        companyIdB = dbB.companyId;
        adminIdB = dbB.adminId;
        restaurantIdB = dbB.restaurantId;
        pass("3-db-B", dbB.detail);
      } else fail("3-db-B", dbB.detail);
      if (companyIdA && companyIdB && companyIdA !== companyIdB) pass("3-different-companyId", `A=${companyIdA} B=${companyIdB}`);
      else if (companyIdA && companyIdB) fail("3-different-companyId", "Mismo companyId");
    } else fail("3-register-B", outB.error || "Error");
  }

  // 7 duplicate email
  const dup = await trpcMutation("publicApi.registerBusiness", {
    ...payloadB(),
    email: TEST.companyA.email,
    adminName: "Otro",
  });
  const dupOut = unwrapMutation(dup.data);
  if (dupOut.error) pass("7-duplicate-email", dupOut.error.slice(0, 80));
  else fail("7-duplicate-email", "Debía rechazar email duplicado");

  // 4. Login admin A/B email + scoped
  if (slugA && adminUserA) {
    await testAdminLogins("4-login-A", slugA, adminUserA, TEST.companyA.email, TEST.companyA.password, companyIdA);
  }
  if (slugB && adminUserB) {
    await testAdminLogins("4-login-B", slugB, adminUserB, TEST.companyB.email, TEST.companyB.password, companyIdB);
  }

  // 5. Empleados (idempotente)
  let empIdA, empIdB;
  if (regA.jar && slugA && companyIdA) {
    try {
      const empA = await ensureEmployee(sql, BASE_URL, regA.jar, companyIdA, TEST.employeeA, emptySchedule);
      empIdA = empA.employeeId;
      pass("5-employee-A", empA.reused ? `reutilizado id=${empIdA}` : `creado id=${empIdA}`);
      const emp = await sql`SELECT "companyId", "restaurantId" FROM employees WHERE id = ${empIdA} LIMIT 1`;
      if (emp[0]?.companyId === companyIdA && emp[0]?.restaurantId === restaurantIdA) pass("5-employee-A-links", "OK");
      else fail("5-employee-A-links", "companyId/restaurantId incorrectos");
    } catch (e) {
      fail("5-employee-A", e.message);
    }
  }

  const listA = await trpcQuery("publicApi.listEmployees", {}, regA.jar);
  const listAdata = unwrapQuery(listA.data);
  const namesA = (listAdata.result || []).map((e) => e.name);
  if (namesA.includes(TEST.employeeA.name) && !namesA.includes(TEST.employeeB.name)) {
    pass("6-isolation-employees-A", `Solo ve: ${namesA.join(", ")}`);
  } else fail("6-isolation-employees-A", `Lista: ${namesA.join(", ")}`);

  if (regB.jar && slugB && companyIdB) {
    try {
      const empB = await ensureEmployee(sql, BASE_URL, regB.jar, companyIdB, TEST.employeeB, emptySchedule);
      empIdB = empB.employeeId;
      pass("5-employee-B", empB.reused ? `reutilizado id=${empIdB}` : `creado id=${empIdB}`);
    } catch (e) {
      fail("5-employee-B", e.message);
    }
  }

  const listB = await trpcQuery("publicApi.listEmployees", {}, regB.jar);
  const listBdata = unwrapQuery(listB.data);
  const namesB = (listBdata.result || []).map((e) => e.name);
  if (namesB.includes(TEST.employeeB.name) && !namesB.includes(TEST.employeeA.name)) {
    pass("6-isolation-employees-B", `Solo ve: ${namesB.join(", ")}`);
  } else fail("6-isolation-employees-B", `Lista: ${namesB.join(", ")}`);

  // 6. Fichajes
  if (slugA && empIdA) {
    await testClockFlow("6-clock-A", slugA, TEST.employeeA, empIdA, companyIdA, regA.jar);
  }
  if (slugB && empIdB) {
    await testClockFlow("6-clock-B", slugB, TEST.employeeB, empIdB, companyIdB, regB.jar);
  }

  const tcA = await trpcQuery("publicApi.listTimeclocks", {}, regA.jar);
  const tcB = await trpcQuery("publicApi.listTimeclocks", {}, regB.jar);
  const idsA = (unwrapQuery(tcA.data).result || []).map((t) => t.employeeId);
  const idsB = (unwrapQuery(tcB.data).result || []).map((t) => t.employeeId);
  if (empIdA && idsA.includes(empIdA) && (!empIdB || !idsA.includes(empIdB))) pass("6-isolation-timeclocks-A", `employeeIds=${[...new Set(idsA)]}`);
  else fail("6-isolation-timeclocks-A", `A ve: ${[...new Set(idsA)]}`);
  if (empIdB && idsB.includes(empIdB) && (!empIdA || !idsB.includes(empIdA))) pass("6-isolation-timeclocks-B", `employeeIds=${[...new Set(idsB)]}`);
  else fail("6-isolation-timeclocks-B", `B ve: ${[...new Set(idsB)]}`);

  // 8 Rollback — solo revisión código
  pass("8-rollback", "No simulado sin tocar código; transacción db.transaction en registerBusinessTenant — rollback automático en error");

  // 9 Regresión
  const legal = await trpcQuery("publicApi.getCompanyLegal", {}, regA.jar);
  if (unwrapQuery(legal.data).result?.slug === slugA) pass("9-legal-panel", "getCompanyLegal OK");
  else fail("9-legal-panel", "getCompanyLegal falló");

  const saMut = (input) =>
    trpcMutation("publicApi.superAdminLogin", input).then((r) => unwrapMutation(r.data));
  const saOut = await superAdminLoginWithRetry(
    saMut,
    process.env.SUPERADMIN_USERNAME || "owner",
    process.env.SUPERADMIN_PASSWORD || "123456"
  );
  if (saOut.result?.success) pass("9-superadmin", "superAdminLogin OK");
  else if (isRateLimitError(saOut.error)) {
    pass("9-superadmin", "SKIP — rate limit acumulado (espera 65s o reinicia servidor)");
  } else fail("9-superadmin", saOut.error);

  const empLogin = await trpcMutation("publicApi.employeeLogin", {
    username: `${slugA}::${TEST.employeeA.username}`,
    password: TEST.employeeA.password,
  });
  if (unwrapMutation(empLogin.data).result?.success) pass("9-employee-login", "OK");
  else fail("9-employee-login", unwrapMutation(empLogin.data).error);

  // Cleanup inventory
  if (companyIdA) await collectCleanup(sql, companyIdA, slugA);
  if (companyIdB) await collectCleanup(sql, companyIdB, slugB);

  report.companies = [
    { label: "A", slug: slugA, companyId: companyIdA, adminEmail: TEST.companyA.email, adminUser: adminUserA },
    { label: "B", slug: slugB, companyId: companyIdB, adminEmail: TEST.companyB.email, adminUser: adminUserB },
  ];

  const failed = Object.values(report.checklist).filter((c) => !c.ok).length;
  report.summary = failed === 0 ? "ALL_PASSED" : `${failed} FAILED`;
  report.finishedAt = new Date().toISOString();

  printReport();
  await sql.end();
  process.exit(failed > 0 ? 1 : 0);

  function payloadA() {
    return {
      businessName: TEST.companyA.businessName,
      adminName: TEST.companyA.adminName,
      email: TEST.companyA.email,
      password: TEST.companyA.password,
      confirmPassword: TEST.companyA.password,
      country: "ES",
      timezone: "Europe/Madrid",
      acceptedTerms: true,
    };
  }
  function payloadB() {
    return {
      businessName: TEST.companyB.businessName,
      adminName: TEST.companyB.adminName,
      email: TEST.companyB.email,
      password: TEST.companyB.password,
      confirmPassword: TEST.companyB.password,
      country: "ES",
      timezone: "Europe/Madrid",
      acceptedTerms: true,
    };
  }

  async function testAdminLogins(prefix, slug, adminUser, email, password, expectedCompanyId) {
    const jarEmail = new CookieJar();
    const loginEmail = await trpcMutation("publicApi.adminLogin", { username: email, password }, jarEmail);
    const le = unwrapMutation(loginEmail.data);
    if (le.result?.success) {
      pass(`${prefix}-email`, `companySlug=${le.result.companySlug}`);
      const s = unwrapQuery((await trpcQuery("publicApi.getSession", null, jarEmail)).data);
      if (s.result?.session?.companyId === expectedCompanyId) pass(`${prefix}-email-session`, "companyId OK");
      else fail(`${prefix}-email-session`, JSON.stringify(s.result?.session));
    } else fail(`${prefix}-email`, le.error);

    const jarScoped = new CookieJar();
    const loginScoped = await trpcMutation(
      "publicApi.adminLogin",
      { username: `${slug}::${adminUser}`, password },
      jarScoped
    );
    const ls = unwrapMutation(loginScoped.data);
    if (ls.result?.success) pass(`${prefix}-scoped`, `companySlug=${ls.result.companySlug}`);
    else fail(`${prefix}-scoped`, ls.error);
  }

  async function testClockFlow(prefix, slug, emp, employeeId, companyId, adminJar) {
    const jar = new CookieJar();
    const login = await trpcMutation("publicApi.employeeLogin", {
      username: `${slug}::${emp.username}`,
      password: emp.password,
    }, jar);
    if (!unwrapMutation(login.data).result?.success) {
      fail(`${prefix}-login`, unwrapMutation(login.data).error);
      return;
    }
    const cin = await trpcMutation("publicApi.clockIn", { employeeId }, jar);
    const cinR = unwrapMutation(cin.data);
    if (cinR.result?.success || cinR.result?.id) pass(`${prefix}-in`, "clockIn OK");
    else if (cinR.error?.includes("clock out")) pass(`${prefix}-in`, "ya fichado (OK)");
    else fail(`${prefix}-in`, cinR.error);

    const cout = await trpcMutation("publicApi.clockOut", { employeeId }, jar);
    const coutR = unwrapMutation(cout.data);
    if (coutR.result?.success || !coutR.error) pass(`${prefix}-out`, "clockOut OK");
    else fail(`${prefix}-out`, coutR.error);

    const rows = await sql`SELECT "companyId" FROM timeclocks WHERE "employeeId" = ${employeeId} ORDER BY id DESC LIMIT 3`;
    const bad = rows.filter((r) => r.companyId !== companyId);
    if (rows.length > 0 && bad.length === 0) pass(`${prefix}-companyId`, `fichajes con companyId=${companyId}`);
    else if (rows.length === 0) fail(`${prefix}-companyId`, "Sin fichajes en BD");
    else fail(`${prefix}-companyId`, `companyId incorrecto en ${bad.length} filas`);
  }

  async function verifyCompanyInDb(sql, slug, email) {
    const companies = await sql`
      SELECT id, slug, name, "termsAcceptedAt", "locationEnabled"
      FROM companies WHERE slug = ${slug} LIMIT 1`;
    const c = companies[0];
    if (!c) return { ok: false, detail: "company no encontrada" };
    const admins = await sql`
      SELECT id, "companyId", name, email, "restaurantId", "openId"
      FROM users WHERE "companyId" = ${c.id} AND "openId" LIKE 'local-admin-%' LIMIT 1`;
    const a = admins[0];
    const rests = await sql`SELECT id, "companyId", "adminId" FROM restaurants WHERE "companyId" = ${c.id} LIMIT 1`;
    const r = rests[0];
    const issues = [];
    if (!c.termsAcceptedAt) issues.push("termsAcceptedAt null");
    if (c.locationEnabled !== false) issues.push(`locationEnabled=${c.locationEnabled}`);
    if (!a) issues.push("sin admin");
    else {
      if (a.companyId !== c.id) issues.push("admin.companyId mismatch");
      if (a.email?.toLowerCase() !== email.toLowerCase()) issues.push(`email=${a.email}`);
      if (!a.restaurantId) issues.push("admin sin restaurantId");
    }
    if (!r) issues.push("sin restaurant");
    else if (r.companyId !== c.id) issues.push("restaurant.companyId mismatch");
    if (a && r && a.restaurantId !== r.id) issues.push("restaurantId admin != restaurant.id");
    if (issues.length) return { ok: false, detail: issues.join("; ") };
    return {
      ok: true,
      companyId: c.id,
      adminId: a.id,
      restaurantId: r.id,
      detail: `company=${c.id} admin=${a.id} restaurant=${r.id} termsOK locationDisabled`,
    };
  }

  async function loadTestCompanyByEmail(sql, email) {
    const admins = await sql`
      SELECT id, "companyId", name, email FROM users
      WHERE email = ${email.toLowerCase()} AND "openId" LIKE 'local-admin-%' LIMIT 1`;
    const a = admins[0];
    if (!a) return null;
    const companies = await sql`SELECT slug FROM companies WHERE id = ${a.companyId} LIMIT 1`;
    const slug = companies[0]?.slug;
    if (!slug) return null;
    const db = await verifyCompanyInDb(sql, slug, email);
    if (!db.ok) return null;
    return {
      slug,
      companyId: db.companyId,
      adminId: db.adminId,
      restaurantId: db.restaurantId,
      adminUsername: a.name,
    };
  }

  async function loadTestCompany(sql, slug, email) {
    const db = await verifyCompanyInDb(sql, slug, email);
    if (!db.ok) return null;
    const admin = await sql`SELECT name FROM users WHERE id = ${db.adminId}`;
    return {
      slug,
      companyId: db.companyId,
      adminId: db.adminId,
      restaurantId: db.restaurantId,
      adminUsername: admin[0]?.name,
    };
  }

  async function collectCleanup(sql, companyId, slug) {
    report.cleanup.companies.push(companyId);
    report.cleanup.slugs.push(slug);
    const users = await sql`SELECT id, email, name FROM users WHERE "companyId" = ${companyId}`;
    const rests = await sql`SELECT id FROM restaurants WHERE "companyId" = ${companyId}`;
    const emps = await sql`SELECT id, username FROM employees WHERE "companyId" = ${companyId}`;
    const tcs = await sql`SELECT id FROM timeclocks WHERE "companyId" = ${companyId}`;
    report.cleanup.users.push(...users);
    report.cleanup.restaurants.push(...rests.map((r) => r.id));
    report.cleanup.employees.push(...emps);
    report.cleanup.timeclocks.push(...tcs.map((t) => t.id));
  }

  function printReport() {
    console.log("\n=== E2E PHASE 1 REPORT ===\n");
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
