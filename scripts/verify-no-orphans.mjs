/**
 * Verifica huérfanos tras limpieza TEST.
 * node scripts/verify-no-orphans.mjs
 */
import dotenv from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

const checks = {
  testCompanies: await sql`SELECT count(*)::int AS c FROM companies WHERE slug LIKE 'test-%' OR name LIKE 'TEST%'`,
  exampleUsers: await sql`SELECT count(*)::int AS c FROM users WHERE email LIKE '%@example.com'`,
  orphanEmployees: await sql`
    SELECT count(*)::int AS c FROM employees e
    LEFT JOIN companies c ON c.id = e."companyId"
    WHERE c.id IS NULL`,
  orphanRestaurants: await sql`
    SELECT count(*)::int AS c FROM restaurants r
    LEFT JOIN companies c ON c.id = r."companyId"
    WHERE c.id IS NULL`,
  orphanTimeclocks: await sql`
    SELECT count(*)::int AS c FROM timeclocks t
    LEFT JOIN companies c ON c.id = t."companyId"
    WHERE c.id IS NULL`,
  orphanSchedules: await sql`
    SELECT count(*)::int AS c FROM schedules s
    LEFT JOIN companies c ON c.id = s."companyId"
    WHERE c.id IS NULL`,
  orphanUsers: await sql`
    SELECT count(*)::int AS c FROM users u
    LEFT JOIN companies c ON c.id = u."companyId"
    WHERE u."companyId" IS NOT NULL AND c.id IS NULL`,
  remainingCompanies: await sql`SELECT id, slug, name FROM companies ORDER BY id`,
};

console.log(JSON.stringify(checks, null, 2));
await sql.end();
