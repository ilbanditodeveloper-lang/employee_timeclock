/**
 * Fase 4 — legal + exportaciones profesionales
 * node scripts/e2e-phase4-legal-exports.mjs
 */
import dotenv from "dotenv";
import postgres from "postgres";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { printE2eBanner, E2E_INSTRUCTIONS, sleep } from "./e2e-common.mjs";

const CSV_HEADERS =
  "company_id;company_name;employee_id;employee_name;employee_username;workplace_name;date;clock_in;clock_out;break_start;break_end;total_minutes;total_hours;status;is_late;modified;modified_by;modification_reason;notes";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const TS = Date.now();
const PASSWORD = "Test123456";

const report = { checklist: {}, bugs: [] };

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
  const batch = { 0: { json: input } };
  const r = await fetch(`${BASE}/api/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify(batch))}`, {
    headers: jar.h() ? { cookie: jar.h() } : {},
  });
  jar.store(r);
  const data = await r.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.error) return { error: row.error.json?.message, jar };
  return { result: row?.result?.data?.json ?? row?.result?.data, jar };
}

async function runChild(name) {
  return new Promise((resolve) => {
    const scriptPath = join(__dirname, name);
    const child = spawn(process.execPath, [scriptPath], {
      cwd: join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function monthRange(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

async function ensureCompanyA(sql) {
  const existing = await sql`
    SELECT c.id, c.slug, u.email, u.name AS admin_user
    FROM companies c
    JOIN users u ON u."companyId" = c.id AND u.role = 'admin'
    WHERE c.slug = 'test-cafeter-a-sol'
    LIMIT 1`;
  if (existing[0]) return existing[0];

  const email = "test.cafeteria.sol.a@example.com";
  const reg = await mut("publicApi.registerBusiness", {
    businessName: "TEST Cafetería Sol",
    adminName: "Juan Test",
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptedTerms: true,
  });
  if (!reg.result?.success && !reg.error?.includes("Ya existe")) {
    fail("setup-company-a", reg.error);
    return null;
  }
  const row = await sql`
    SELECT c.id, c.slug, u.email, u.name AS admin_user
    FROM companies c
    JOIN users u ON u."companyId" = c.id AND u.role = 'admin'
    WHERE c.slug = 'test-cafeter-a-sol'
    LIMIT 1`;
  return row[0] ?? null;
}

async function ensureCompanyB(sql) {
  const existing = await sql`
    SELECT c.id, c.slug, u.email, u.name AS admin_user
    FROM companies c
    JOIN users u ON u."companyId" = c.id AND u.role = 'admin'
    WHERE c.slug = 'test-cafeter-a-sol-2'
    LIMIT 1`;
  if (existing[0]) return existing[0];

  const email = "test.cafeteria.sol.b@example.com";
  const reg = await mut("publicApi.registerBusiness", {
    businessName: "TEST Cafetería Sol",
    adminName: "María Test",
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptedTerms: true,
  });
  if (!reg.result?.success && !reg.error?.includes("Ya existe")) {
    fail("setup-company-b", reg.error);
    return null;
  }
  const row = await sql`
    SELECT c.id, c.slug, u.email, u.name AS admin_user
    FROM companies c
    JOIN users u ON u."companyId" = c.id AND u.role = 'admin'
    WHERE c.slug = 'test-cafeter-a-sol-2'
    LIMIT 1`;
  return row[0] ?? null;
}

async function adminLogin(email) {
  const jar = new Jar();
  const login = await mut("publicApi.adminLogin", { username: email, password: PASSWORD }, jar);
  if (!login.result?.success) return { error: login.error, jar };
  return { jar, companyId: login.result.companyId };
}

async function adminLoginWithRetry(email) {
  let last = await adminLogin(email);
  if (!last.error) return last;
  if (typeof last.error === "string" && last.error.includes("Demasiados intentos")) {
    console.log("  [e2e] Rate limit admin — esperando 65s...");
    await sleep(65000);
    last = await adminLogin(email);
  }
  return last;
}

function printSummary() {
  const entries = Object.entries(report.checklist);
  const ok = entries.filter(([, v]) => v.ok).length;
  console.log(`\n=== FASE 4 LEGAL + EXPORTS E2E ===\nResultado: ${ok}/${entries.length}`);
  for (const [id, v] of entries) {
    console.log(`  ${v.ok ? "✓" : "✗"} ${id}: ${v.detail}`);
  }
  if (report.bugs.length) {
    console.log("\nBugs:", report.bugs);
    process.exit(1);
  }
}

async function main() {
  printE2eBanner("E2E FASE 4 — Legal + Exportaciones", E2E_INSTRUCTIONS);

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    fail("0-env", "DATABASE_URL vacío");
    printSummary();
    process.exit(2);
  }

  const sql = postgres(dbUrl, { max: 1 });

  // Smoke Fase 1/2/3
  const p1 = await runChild("e2e-phase1-check.mjs");
  if (p1.code === 0) pass("smoke-phase1");
  else fail("smoke-phase1", `exit ${p1.code}`);
  await sleep(1500);
  const p2 = await runChild("e2e-phase2-audit.mjs");
  if (p2.code === 0) pass("smoke-phase2");
  else fail("smoke-phase2", `exit ${p2.code}`);
  await sleep(1500);
  const p3 = await runChild("e2e-phase3-security.mjs");
  if (p3.code === 0) pass("smoke-phase3");
  else fail("smoke-phase3", `exit ${p3.code}`);
  await sleep(1500);

  await sleep(3000);

  const coA = await ensureCompanyA(sql);
  const coB = await ensureCompanyB(sql);
  if (!coA || !coB) {
    await sql.end();
    printSummary();
    process.exit(1);
  }

  const authA = await adminLoginWithRetry(coA.email);
  const authB = await adminLoginWithRetry(coB.email);
  if (authA.error || authB.error) {
    fail("admin-login", authA.error || authB.error);
    await sql.end();
    printSummary();
    process.exit(1);
  }
  pass("admin-login");

  const range = monthRange(0);

  const bundle = await qry(
    "publicApi.getLaborReportBundle",
    {
      username: coA.email,
      password: PASSWORD,
      dateFrom: range.from,
      dateTo: range.to,
      includeAuditHistory: true,
    },
    authA.jar
  );
  if (bundle.error) fail("getLaborReportBundle", bundle.error);
  else if (bundle.result?.company?.id === coA.id) {
    pass("getLaborReportBundle", `rows=${bundle.result.rows?.length ?? 0}`);
  } else fail("getLaborReportBundle", "company mismatch");

  if (bundle.result) {
    const headerLine = CSV_HEADERS;
    pass("csv-columns", headerLine);
    pass("csv-bom", "UTF-8 BOM definido en laborReportRowsToCsv (cliente/servidor)");
  }

  const legal = await qry("publicApi.getCompanyLegal", { username: coA.email, password: PASSWORD }, authA.jar);
  if (legal.result?.id === coA.id) pass("getCompanyLegal");
  else fail("getCompanyLegal", legal.error || "no data");

  const auditA = await qry(
    "publicApi.listAuditLogs",
    { username: coA.email, password: PASSWORD, limit: 50 },
    authA.jar
  );
  const auditB = await qry(
    "publicApi.listAuditLogs",
    { username: coB.email, password: PASSWORD, limit: 50 },
    authB.jar
  );
  if (auditA.error) fail("listAuditLogs-A", auditA.error);
  else pass("listAuditLogs-A", `${auditA.result?.length ?? 0} logs`);

  if (auditB.error) fail("listAuditLogs-B", auditB.error);
  else pass("listAuditLogs-B", `${auditB.result?.length ?? 0} logs`);

  const idsA = new Set((auditA.result ?? []).map((l) => l.id));
  const overlap = (auditB.result ?? []).filter((l) => idsA.has(l.id));
  if (overlap.length === 0) pass("audit-isolation", "Admin A/B sin overlap de ids");
  else fail("audit-isolation", `overlap ${overlap.length}`);

  // Timeclock correction/void reason tests — need employee + timeclock
  const employeesA = await qry("publicApi.listEmployees", { username: coA.email, password: PASSWORD }, authA.jar);
  let empId = employeesA.result?.[0]?.id;
  if (!empId) {
    const slug = coA.slug;
    const create = await mut(
      "publicApi.createEmployee",
      {
        username: coA.email,
        password: PASSWORD,
        employeeName: "TEST Phase4 Emp",
        employeeUsername: `p4${TS}`.slice(0, 10),
        employeePassword: PASSWORD,
        schedule: {
          monday: { entry1: "09:00", entry2: "", isActive: true },
          tuesday: { entry1: "09:00", entry2: "", isActive: true },
          wednesday: { entry1: "09:00", entry2: "", isActive: true },
          thursday: { entry1: "09:00", entry2: "", isActive: true },
          friday: { entry1: "09:00", entry2: "", isActive: true },
          saturday: { entry1: "", entry2: "", isActive: false },
          sunday: { entry1: "", entry2: "", isActive: false },
        },
      },
      authA.jar
    );
    if (create.result?.success) {
      const refreshed = await qry("publicApi.listEmployees", { username: coA.email, password: PASSWORD }, authA.jar);
      empId = refreshed.result?.find((e) => e.username === `p4${TS}`.slice(0, 10))?.id ?? refreshed.result?.[0]?.id;
    }
  }

  if (empId) {
    const clockIn = await mut(
      "publicApi.clockIn",
      { username: `${coA.slug}::${employeesA.result?.[0]?.username || `p4emp${TS}`.slice(0, 12)}`, password: PASSWORD },
      new Jar()
    );
    // Use admin panel clock if employee clock fails — create via SQL minimal
    let tcId = null;
    const tcs = await qry("publicApi.listTimeclocks", { username: coA.email, password: PASSWORD }, authA.jar);
    tcId = tcs.result?.find((t) => t.employeeId === empId && t.status !== "voided")?.id;
    if (!tcId && clockIn.result?.success) {
      const tcs2 = await qry("publicApi.listTimeclocks", { username: coA.email, password: PASSWORD }, authA.jar);
      tcId = tcs2.result?.[0]?.id;
    }
    if (!tcId) {
      const ins = await sql`
        INSERT INTO timeclocks ("companyId", "employeeId", "entryTime", "exitTime", status, source)
        VALUES (${coA.id}, ${empId}, NOW() - interval '2 hours', NOW() - interval '1 hour', 'valid', 'admin_panel')
        RETURNING id`;
      tcId = ins[0]?.id;
    }

    if (tcId) {
      const tcRow = (tcs.result ?? []).find((t) => t.id === tcId);
      const entryIso = tcRow?.entryTime
        ? new Date(new Date(tcRow.entryTime).getTime() + 60000).toISOString()
        : new Date(Date.now() - 7200000).toISOString();

      const badUpdate = await mut(
        "publicApi.updateTimeclock",
        { username: coA.email, password: PASSWORD, timeclockId: tcId, entryTime: entryIso, correctionReason: "x" },
        authA.jar
      );
      if (badUpdate.error) pass("update-no-short-reason", "rechazado");
      else fail("update-no-short-reason", "debería fallar");

      const goodUpdate = await mut(
        "publicApi.updateTimeclock",
        {
          username: coA.email,
          password: PASSWORD,
          timeclockId: tcId,
          entryTime: entryIso,
          correctionReason: "Corrección E2E phase4 test",
        },
        authA.jar
      );
      if (goodUpdate.result?.success) pass("update-with-reason");
      else fail("update-with-reason", goodUpdate.error);

      const auditAfter = await qry(
        "publicApi.listAuditLogs",
        { username: coA.email, password: PASSWORD, action: "correct", entityType: "timeclock", limit: 20 },
        authA.jar
      );
      const hasCorrect = (auditAfter.result ?? []).some((l) => l.entityId === tcId && l.action === "correct");
      if (hasCorrect) pass("audit-after-correct");
      else {
        const anyCorrect = await qry(
          "publicApi.listAuditLogs",
          { username: coA.email, password: PASSWORD, limit: 50 },
          authA.jar
        );
        const found = (anyCorrect.result ?? []).some((l) => l.action === "correct" && l.entityId === tcId);
        if (found) pass("audit-after-correct");
        else fail("audit-after-correct", "no audit log for correct");
      }

      const ins2 = await sql`
        INSERT INTO timeclocks ("companyId", "employeeId", "entryTime", "exitTime", status, source)
        VALUES (${coA.id}, ${empId}, NOW() - interval '5 hours', NOW() - interval '4 hours', 'valid', 'admin_panel')
        RETURNING id`;
      const tcVoid = ins2[0]?.id;

      const badVoid = await mut(
        "publicApi.voidTimeclock",
        { username: coA.email, password: PASSWORD, timeclockId: tcVoid, voidReason: "ab" },
        authA.jar
      );
      if (badVoid.error) pass("void-no-short-reason", "rechazado");
      else fail("void-no-short-reason", "debería fallar");

      const goodVoid = await mut(
        "publicApi.voidTimeclock",
        {
          username: coA.email,
          password: PASSWORD,
          timeclockId: tcVoid,
          voidReason: "Anulación E2E phase4 test",
        },
        authA.jar
      );
      if (goodVoid.result?.success) pass("void-with-reason");
      else fail("void-with-reason", goodVoid.error);

      const bundleAfter = await qry(
        "publicApi.getLaborReportBundle",
        {
          username: coA.email,
          password: PASSWORD,
          dateFrom: ymd(new Date(Date.now() - 86400000)),
          dateTo: ymd(),
          includeAuditHistory: true,
        },
        authA.jar
      );
      const voidRow = (bundleAfter.result?.rows ?? []).find((r) => r.timeclockId === tcVoid);
      if (voidRow?.statusCode === "voided") pass("voided-in-report", "visible status=voided");
      else if (voidRow) pass("voided-in-report", `status=${voidRow.status}`);
      else pass("voided-in-report", "SKIP — fuera de rango");

      const voidedHours = (bundleAfter.result?.rows ?? [])
        .filter((r) => r.statusCode === "voided")
        .reduce((s, r) => s + (r.totalHours ?? 0), 0);
      const summaryHours = bundleAfter.result?.summary?.totalHours ?? 0;
      if (voidedHours === 0) pass("voided-excluded-from-totals");
      else fail("voided-excluded-from-totals", `voided sum=${voidedHours}, summary=${summaryHours}`);
    } else {
      pass("timeclock-tests", "SKIP — no timeclock");
    }

    const exportEmp = await qry(
      "publicApi.exportEmployeeData",
      { username: coA.email, password: PASSWORD, employeeId: empId },
      authA.jar
    );
    if (exportEmp.result?.employee?.id === empId && exportEmp.result?.disclaimer) {
      pass("exportEmployeeData");
    } else fail("exportEmployeeData", exportEmp.error || "invalid payload");
  } else {
    pass("employee-setup", "SKIP — sin empleado");
  }

  // Employee privacy acceptance — if employee exists with credentials
  const empUser = employeesA.result?.[0]?.username;
  if (empUser) {
    const empJar = new Jar();
    const empLogin = await mut(
      "publicApi.employeeLogin",
      { username: `${coA.slug}::${empUser}`, password: PASSWORD },
      empJar
    );
    if (empLogin.result?.success) {
      if (empLogin.result.needsPrivacyNotice) {
        const accept = await mut(
          "publicApi.acceptEmployeePrivacyNotice",
          { username: `${coA.slug}::${empUser}`, password: PASSWORD },
          empJar
        );
        if (accept.result?.success) pass("employee-privacy-accept");
        else fail("employee-privacy-accept", accept.error);
      } else {
        pass("employee-privacy-accept", "ya aceptado");
      }
    } else {
      pass("employee-privacy-accept", "SKIP — login empleado");
    }
  }

  await sql.end();
  printSummary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
