/**
 * Limpieza segura de datos TEST en Supabase.
 *
 * Dry-run (default): node scripts/cleanup-test-data.mjs
 * Borrar:           node scripts/cleanup-test-data.mjs --confirm
 */
import dotenv from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const confirm = process.argv.includes("--confirm");
const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error("DATABASE_URL no configurado");
  process.exit(2);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1 });

const testCompanies = await sql`
  SELECT id, slug, name FROM companies
  WHERE slug LIKE 'test-%'
     OR name LIKE 'TEST %'
     OR name LIKE 'TEST%'
  ORDER BY id`;

const companyIds = testCompanies.map((c) => c.id);

const realGuard = await sql`
  SELECT id, slug, name FROM companies
  WHERE slug NOT LIKE 'test-%'
    AND name NOT LIKE 'TEST %'
    AND name NOT LIKE 'TEST%'
  ORDER BY id`;

if (realGuard.length > 0) {
  console.log("Empresas REALES preservadas (no se tocarán):");
  console.log(JSON.stringify(realGuard, null, 2));
}

if (companyIds.length === 0) {
  console.log("No hay empresas TEST para borrar.");
  await sql.end();
  process.exit(0);
}

const counts = {
  companies: testCompanies.length,
  users: (
    await sql`SELECT count(*)::int AS c FROM users WHERE "companyId" = ANY(${companyIds}) OR email LIKE '%@example.com'`
  )[0].c,
  restaurants: (await sql`SELECT count(*)::int AS c FROM restaurants WHERE "companyId" = ANY(${companyIds})`)[0].c,
  employees: (await sql`SELECT count(*)::int AS c FROM employees WHERE "companyId" = ANY(${companyIds})`)[0].c,
  timeclocks: (await sql`SELECT count(*)::int AS c FROM timeclocks WHERE "companyId" = ANY(${companyIds})`)[0].c,
  incidents: (await sql`SELECT count(*)::int AS c FROM incidents WHERE "companyId" = ANY(${companyIds})`)[0].c,
  schedules: (await sql`SELECT count(*)::int AS c FROM schedules WHERE "companyId" = ANY(${companyIds})`)[0].c,
  timeOff: (await sql`SELECT count(*)::int AS c FROM time_off_requests WHERE "companyId" = ANY(${companyIds})`)[0].c,
  legal: (await sql`SELECT count(*)::int AS c FROM legal_acceptances WHERE "companyId" = ANY(${companyIds})`)[0].c,
  push: (await sql`SELECT count(*)::int AS c FROM push_subscriptions WHERE "companyId" = ANY(${companyIds})`)[0].c,
  audit: (await sql`SELECT count(*)::int AS c FROM audit_logs WHERE "companyId" = ANY(${companyIds})`)[0].c,
  notificationLogs: (
    await sql`SELECT count(*)::int AS c FROM notification_logs WHERE "companyId" = ANY(${companyIds})`
  )[0].c,
};

console.log(JSON.stringify({ mode: confirm ? "DELETE" : "DRY-RUN", companyIds, slugs: testCompanies.map((c) => c.slug), counts }, null, 2));

if (!confirm) {
  console.log("\nNo se borró nada. Ejecuta con --confirm para eliminar.");
  await sql.end();
  process.exit(0);
}

console.log("\nBorrando en orden seguro...");

await sql.begin(async (tx) => {
  await tx`DELETE FROM notification_logs WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM audit_logs WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM legal_acceptances WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM push_subscriptions WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM time_off_requests WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM incidents WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM timeclocks WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM schedules WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM employees WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM restaurants WHERE "companyId" = ANY(${companyIds})`;
  await tx`DELETE FROM users WHERE "companyId" = ANY(${companyIds}) OR email LIKE '%@example.com'`;
  await tx`DELETE FROM companies WHERE id = ANY(${companyIds})`;
});

console.log("Limpieza completada.");
await sql.end();
