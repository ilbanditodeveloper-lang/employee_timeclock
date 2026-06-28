/**
 * Inventario de datos TEST en Supabase (solo lectura).
 * node scripts/inventory-test-data.mjs
 */
import dotenv from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error("DATABASE_URL no configurado");
  process.exit(2);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1 });

try {
  const companies = await sql`
    SELECT id, slug, name, "onboardingCompleted", "isActive", "createdAt"
    FROM companies
    WHERE slug LIKE 'test-%' OR name LIKE 'TEST %' OR name LIKE 'TEST%'
    ORDER BY id`;
  const companyIds = companies.map((c) => c.id);

  const users = await sql`
    SELECT u.id, u."companyId", u.email, u.name, u.role, u."openId"
    FROM users u
    WHERE u.email LIKE '%@example.com'
       OR u."openId" LIKE 'local-admin-%' AND u."companyId" = ANY(${companyIds.length ? companyIds : [-1]})
    ORDER BY u.id`;

  const restaurants = companyIds.length
    ? await sql`
        SELECT id, "companyId", name, "adminId"
        FROM restaurants WHERE "companyId" = ANY(${companyIds})
        ORDER BY id`
    : [];

  const employees = companyIds.length
    ? await sql`
        SELECT id, "companyId", "restaurantId", name, username, "isActive"
        FROM employees WHERE "companyId" = ANY(${companyIds})
           OR username IN ('empleadoa', 'empleadob')
        ORDER BY id`
    : [];

  const employeeIds = employees.map((e) => e.id);

  const timeclocks = employeeIds.length
    ? await sql`SELECT id, "companyId", "employeeId", "entryTime", "exitTime" FROM timeclocks WHERE "employeeId" = ANY(${employeeIds}) OR "companyId" = ANY(${companyIds}) ORDER BY id`
    : [];

  const incidents = companyIds.length
    ? await sql`SELECT id, "companyId", "employeeId", type, status FROM incidents WHERE "companyId" = ANY(${companyIds}) ORDER BY id`
    : [];

  const schedules = companyIds.length
    ? await sql`SELECT id, "companyId", "employeeId", "dayOfWeek" FROM schedules WHERE "companyId" = ANY(${companyIds}) ORDER BY id`
    : [];

  const timeOff = companyIds.length
    ? await sql`SELECT id, "companyId", "employeeId", status FROM time_off_requests WHERE "companyId" = ANY(${companyIds}) ORDER BY id`
    : [];

  const legal = companyIds.length
    ? await sql`SELECT id, "companyId", "employeeId", "documentType" FROM legal_acceptances WHERE "companyId" = ANY(${companyIds}) ORDER BY id`
    : [];

  const push = companyIds.length
    ? await sql`SELECT id, "companyId", "employeeId", left(endpoint, 60) AS endpoint_preview FROM push_subscriptions WHERE "companyId" = ANY(${companyIds}) ORDER BY id`
    : [];

  const audit = companyIds.length
    ? await sql`SELECT id, "companyId", "entityType", action FROM audit_logs WHERE "companyId" = ANY(${companyIds}) ORDER BY id LIMIT 50`
    : [];

  const notificationLogs = companyIds.length
    ? await sql`SELECT id, "companyId", "employeeId" FROM notification_logs WHERE "companyId" = ANY(${companyIds}) ORDER BY id LIMIT 50`
    : [];

  // Empresas reales (no test) para no tocar
  const realCompanies = await sql`
    SELECT id, slug, name FROM companies
    WHERE slug NOT LIKE 'test-%' AND name NOT LIKE 'TEST %' AND name NOT LIKE 'TEST%'
    ORDER BY id`;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      testCompanies: companies.length,
      testUsers: users.length,
      testRestaurants: restaurants.length,
      testEmployees: employees.length,
      testTimeclocks: timeclocks.length,
      testIncidents: incidents.length,
      testSchedules: schedules.length,
      testTimeOff: timeOff.length,
      testLegalAcceptances: legal.length,
      testPushSubscriptions: push.length,
      testAuditLogs: audit.length,
      testNotificationLogs: notificationLogs.length,
      preservedRealCompanies: realCompanies.length,
    },
    preservedRealCompanies: realCompanies,
    testData: {
      companies,
      users,
      restaurants,
      employees,
      timeclocks,
      incidents,
      schedules,
      timeOffRequests: timeOff,
      legalAcceptances: legal,
      pushSubscriptions: push,
      auditLogs: audit,
      notificationLogs,
    },
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}
