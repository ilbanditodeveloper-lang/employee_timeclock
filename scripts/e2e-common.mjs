/**
 * Utilidades compartidas para scripts E2E.
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function printE2eBanner(title, lines = []) {
  console.log(`\n=== ${title} ===`);
  for (const line of lines) console.log(`  ${line}`);
  console.log("");
}

export const E2E_INSTRUCTIONS = [
  "Requisitos: DATABASE_URL en .env.local, servidor en http://localhost:3000 (npm run dev)",
  "Orden recomendado: phase1 → phase2 → phase3 (pausa 65s entre scripts si superadmin falla por rate limit)",
  "Inventario TEST: node scripts/inventory-test-data.mjs",
  "Limpieza TEST: node scripts/cleanup-test-data.mjs --confirm",
];

export function isRateLimitError(message) {
  return typeof message === "string" && message.includes("Demasiados intentos");
}

/** Login superadmin con reintento tras rate limit in-memory (65s). */
export async function superAdminLoginWithRetry(mutFn, username, password, waitMs = 65_000) {
  let result = await mutFn({ username, password });
  if (result.error && isRateLimitError(result.error)) {
    console.log(`  [e2e] Rate limit superadmin — esperando ${waitMs / 1000}s...`);
    await sleep(waitMs);
    result = await mutFn({ username, password });
  }
  return result;
}

export class CookieJar {
  #cookies = new Map();
  store(res) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
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

export async function trpcMutation(baseUrl, path, input, jar = new CookieJar()) {
  const res = await fetch(`${baseUrl}/api/trpc/${path}`, {
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

export async function trpcQuery(baseUrl, path, input = {}, jar = new CookieJar()) {
  const batchInput = input === undefined || input === null ? { 0: { json: {} } } : { 0: { json: input } };
  const encoded = encodeURIComponent(JSON.stringify(batchInput));
  const res = await fetch(`${baseUrl}/api/trpc/${path}?batch=1&input=${encoded}`, {
    headers: jar.header() ? { cookie: jar.header() } : {},
  });
  jar.store(res);
  const data = await res.json();
  const batch = Array.isArray(data) ? data[0] : data;
  return { data: batch, jar, status: res.status };
}

export function unwrapMutation(data) {
  if (data?.error) return { error: data.error.json?.message || JSON.stringify(data.error) };
  return { result: data?.result?.data?.json ?? data?.result?.data };
}

export function unwrapQuery(batch) {
  if (batch?.error) return { error: batch.error.json?.message || "query error" };
  return { result: batch?.result?.data?.json ?? batch?.result?.data };
}

/** Busca empleado por company+username o lo crea; idempotente para re-ejecución. */
export async function ensureEmployee(sql, baseUrl, jar, companyId, spec, emptySchedule) {
  const existing = await sql`
    SELECT id FROM employees WHERE "companyId" = ${companyId} AND username = ${spec.username} LIMIT 1`;
  if (existing[0]) {
    return { employeeId: existing[0].id, reused: true };
  }
  const create = await trpcMutation(baseUrl, "publicApi.createEmployee", {
    employeeName: spec.name,
    employeeUsername: spec.username,
    employeePassword: spec.password,
    lateGraceMinutes: 5,
    schedule: emptySchedule,
  }, jar);
  const out = unwrapMutation(create.data);
  if (out.error) {
    const again = await sql`
      SELECT id FROM employees WHERE "companyId" = ${companyId} AND username = ${spec.username} LIMIT 1`;
    if (again[0]) return { employeeId: again[0].id, reused: true };
    throw new Error(out.error);
  }
  const row = await sql`
    SELECT id FROM employees WHERE "companyId" = ${companyId} AND username = ${spec.username} LIMIT 1`;
  return { employeeId: row[0]?.id, reused: false };
}
