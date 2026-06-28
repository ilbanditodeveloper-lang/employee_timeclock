/**
 * Pre-check antes de migración 0008: emails admin self-service duplicados.
 * node scripts/check-admin-email-duplicates.mjs
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
  const dups = await sql`
    SELECT lower(trim(email)) AS email_norm,
           array_agg(id ORDER BY id) AS user_ids,
           count(*)::int AS cnt
    FROM users
    WHERE email IS NOT NULL AND trim(email) <> ''
      AND role = 'admin'
      AND "openId" LIKE 'local-admin-%'
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
  `;

  if (dups.length === 0) {
    console.log(JSON.stringify({ ok: true, duplicateCount: 0, duplicates: [] }, null, 2));
    process.exit(0);
  }

  console.log(
    JSON.stringify(
      {
        ok: false,
        duplicateCount: dups.length,
        duplicates: dups,
        message:
          "Hay emails admin duplicados. Resuélvelos manualmente antes de aplicar 0008_admin_email_unique.sql",
      },
      null,
      2
    )
  );
  process.exit(1);
} finally {
  await sql.end();
}
