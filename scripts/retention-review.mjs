#!/usr/bin/env node
/**
 * retention:review — lista registros que superan el plazo configurado.
 * No borra automáticamente; la empresa debe decidir según obligaciones legales.
 *
 * Uso: node scripts/retention-review.mjs
 * Requiere DATABASE_URL en el entorno.
 */
import pg from "pg";

const MIN_YEARS = 4;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL no configurada");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const companies = await client.query(
    `SELECT id, name, data_retention_years, minimum_retention_years, legal_hold_enabled
     FROM companies WHERE is_active = true`
  );

  console.log("=== Revisión de retención TimeClock ===\n");
  console.log(
    "La app no borra registros obligatorios antes de 4 años. Tras el plazo, decida según obligaciones legales.\n"
  );

  for (const c of companies.rows) {
    const years = Math.max(
      MIN_YEARS,
      c.minimum_retention_years ?? MIN_YEARS,
      c.data_retention_years ?? MIN_YEARS
    );
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    const cutoffIso = cutoff.toISOString();

    const tc = await client.query(
      `SELECT COUNT(*)::int AS n FROM timeclocks WHERE "companyId" = $1 AND "entryTime" < $2`,
      [c.id, cutoffIso]
    );

    console.log(
      `Empresa #${c.id} ${c.name}: retención ${years} años, legal_hold=${c.legal_hold_enabled}, fichajes anteriores a ${cutoffIso.slice(0, 10)}: ${tc.rows[0].n}`
    );
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
