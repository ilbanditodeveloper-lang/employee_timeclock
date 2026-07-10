/**
 * Verificación de base de datos para staging/producción (solo lectura).
 *
 * node scripts/verify-production-db.mjs
 * node scripts/verify-production-db.mjs --production
 * node scripts/verify-production-db.mjs --staging
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

const report = { ok: true, checks: [], warnings: [], errors: [] };

function pass(id, detail = "OK") {
  report.checks.push({ id, ok: true, detail });
}
function warn(id, detail) {
  report.warnings.push({ id, detail });
  report.checks.push({ id, ok: true, detail: `WARN: ${detail}` });
}
function fail(id, detail) {
  report.ok = false;
  report.errors.push({ id, detail });
  report.checks.push({ id, ok: false, detail });
}

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  fail("DATABASE_URL", "no configurado");
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1, max_lifetime: 60 });

try {
  await sql`SELECT 1 AS ok`;
  pass("db-connect");
} catch (e) {
  fail("db-connect", e instanceof Error ? e.message : String(e));
  await sql.end();
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const requiredColumns = [
  { table: "companies", column: "onboardingCompleted" },
  { table: "companies", column: "legalName" },
  { table: "companies", column: "subscriptionPlan" },
  { table: "timeclocks", column: "status" },
  { table: "audit_logs", column: "companyId" },
  { table: "legal_acceptances", column: "documentVersion" },
  { table: "employees", column: "contractType" },
  { table: "users", column: "adminRole" },
];

const requiredTables = ["company_legal_acceptances", "timeclock_breaks", "gdpr_requests"];

for (const { table, column } of requiredColumns) {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
    LIMIT 1`;
  if (rows.length) pass(`schema-${table}-${column}`);
  else fail(`schema-${table}-${column}`, "columna no encontrada — ejecuta pnpm db:migrate");
}

for (const table of requiredTables) {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
    LIMIT 1`;
  if (rows.length) pass(`schema-table-${table}`);
  else fail(`schema-table-${table}`, "tabla no encontrada — ejecuta npm run db:migrate");
}

const indexRows = await sql`
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'users_admin_email_lower_unique_idx'`;
if (indexRows.length) pass("index-admin-email-unique");
else fail("index-admin-email-unique", "falta migración 0008");

const dups = await sql`
  SELECT lower(trim(email)) AS email_norm, count(*)::int AS cnt
  FROM users
  WHERE email IS NOT NULL AND trim(email) <> ''
    AND role = 'admin'
    AND "openId" LIKE 'local-admin-%'
  GROUP BY lower(trim(email))
  HAVING count(*) > 1`;
if (dups.length === 0) pass("admin-email-duplicates");
else fail("admin-email-duplicates", `${dups.length} email(s) admin duplicados`);

const testCompanies = await sql`
  SELECT id, slug, name FROM companies
  WHERE slug LIKE 'test-%' OR name LIKE 'TEST %' OR name LIKE 'TEST%'
  ORDER BY id LIMIT 20`;

const testUsers = await sql`
  SELECT id, email FROM users WHERE email LIKE '%@example.com' LIMIT 20`;

if (testCompanies.length === 0 && testUsers.length === 0) {
  pass("test-data", "sin datos TEST");
} else if (isProduction) {
  fail(
    "test-data",
    `${testCompanies.length} companies TEST, ${testUsers.length} users @example.com`
  );
} else if (isStaging) {
  warn("test-data", `${testCompanies.length} TEST companies, ${testUsers.length} @example.com (OK staging)`);
} else {
  warn("test-data", `${testCompanies.length} TEST companies, ${testUsers.length} @example.com`);
}

await sql.end();

console.log(JSON.stringify({ ...report, testCompanies, testUsersSample: testUsers }, null, 2));
process.exit(report.ok ? 0 : 1);
