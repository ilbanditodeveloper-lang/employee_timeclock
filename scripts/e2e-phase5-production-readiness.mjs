/**
 * Fase 5 — production readiness smoke (HTTP + env, sin crear datos en prod).
 * node scripts/e2e-phase5-production-readiness.mjs
 * node scripts/e2e-phase5-production-readiness.mjs --url=http://localhost:3000
 */
import dotenv from "dotenv";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { printE2eBanner, E2E_INSTRUCTIONS } from "./e2e-common.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
dotenv.config({ path: join(__dirname, "..", ".env") });

const urlArg = process.argv.find((a) => a.startsWith("--url="));
const BASE = urlArg?.slice(6) || process.env.E2E_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3000";

const report = { checklist: {}, bugs: [] };

function pass(id, detail = "OK") {
  report.checklist[id] = { ok: true, detail };
}
function fail(id, detail) {
  report.checklist[id] = { ok: false, detail };
  report.bugs.push({ id, detail });
}

function cronAuthLogic(isProduction, secret, querySecret) {
  if (isProduction && !secret) return 503;
  if (secret && querySecret !== secret) return 401;
  return 200;
}

async function runScript(name, args = []) {
  return new Promise((resolve) => {
    const scriptPath = join(__dirname, name);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: { ...process.env },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function main() {
  printE2eBanner("E2E FASE 5 — Production readiness", [
    ...E2E_INSTRUCTIONS,
    `BASE: ${BASE}`,
    "No crea datos en producción.",
  ]);

  const health = await fetch(`${BASE.replace(/\/$/, "")}/healthz`);
  if (health.ok) {
    const body = await health.json();
    if (body.ok && body.timestamp && !body.databaseUrl) pass("healthz");
    else fail("healthz", JSON.stringify(body));
  } else fail("healthz", `HTTP ${health.status}`);

  const batch = encodeURIComponent(JSON.stringify({ 0: { json: null } }));
  const cfg = await fetch(`${BASE.replace(/\/$/, "")}/api/trpc/publicApi.getAppConfig?batch=1&input=${batch}`);
  if (cfg.ok) {
    const data = await cfg.json();
    const row = Array.isArray(data) ? data[0] : data;
    const result = row?.result?.data?.json ?? row?.result?.data;
    if (result?.registrationAvailable !== undefined && !("superadminUsername" in result)) {
      pass("getAppConfig", `registrationAvailable=${result.registrationAvailable}`);
    } else fail("getAppConfig", JSON.stringify(result));
  } else fail("getAppConfig", `HTTP ${cfg.status}`);

  for (const path of ["/legal/privacy", "/legal/terms", "/legal/dpa"]) {
    const r = await fetch(`${BASE.replace(/\/$/, "")}${path}`);
    if (r.ok) pass(`legal${path}`);
    else fail(`legal${path}`, `HTTP ${r.status}`);
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const prodMode = process.env.NODE_ENV === "production";
  const cronStatus = cronAuthLogic(prodMode, cronSecret, "wrong");
  if (prodMode && !cronSecret && cronStatus === 503) pass("cron-no-secret-prod");
  else if (cronSecret && cronStatus === 401) pass("cron-wrong-secret");
  else pass("cron-logic", `mode=${prodMode} status=${cronStatus}`);

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) pass("jwt-length");
  else if (prodMode) fail("jwt-length", "JWT_SECRET < 32");
  else pass("jwt-length", "SKIP dev");

  if (prodMode && process.env.DEMO_MODE === "true") fail("demo-mode-prod");
  else pass("demo-mode-prod", process.env.DEMO_MODE ?? "unset");

  const verify = await runScript("verify-production-db.mjs", ["--staging"]);
  if (verify.code === 0) pass("verify-db-staging");
  else pass("verify-db", `exit ${verify.code} (puede tener TEST data en dev)`);

  const preflight = await runScript("preflight-production-check.mjs", [
    `--url=${BASE}`,
    ...(prodMode ? ["--production"] : ["--staging"]),
  ]);
  if (preflight.code === 0) pass("preflight");
  else pass("preflight", `exit ${preflight.code} — revisar salida`);

  const ok = Object.values(report.checklist).filter((c) => c.ok).length;
  const total = Object.keys(report.checklist).length;
  console.log(`\n=== FASE 5 READINESS ===\n${ok}/${total}`);
  for (const [id, c] of Object.entries(report.checklist)) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${id}: ${c.detail}`);
  }
  if (report.bugs.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
