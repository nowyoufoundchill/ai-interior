import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * One-command P0.2 gate runner (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.2).
 *
 * Runs the API-level suites that prove resilient single-photo rendering:
 *   start next dev (AI_MODE=mock) -> seed:test -> suite:jobs ->
 *   suite:failure-fixtures (render atomicity + fixtures through the durable
 *   render runner) -> suite:integrity (render linkage + one-current-per-photo)
 *   -> teardown:test -> check:residue -> stop server
 *
 * The browser durable-render proof lives in `npm run suite:e2e` (run against
 * the same server), which the plan's live gate exercises. This runner covers
 * the deterministic API/DB gate items in one step.
 *
 *   npm run verify:p0-2
 */

const PORT = process.env.VERIFY_PORT || "3132";
const BASE_URL = `http://localhost:${PORT}`;
const cwd = process.cwd();

function fail(message) {
  console.error(`\n[verify:p0-2] FAIL CLOSED: ${message}`);
  process.exit(1);
}

function preflight() {
  const envLocal = path.join(cwd, ".env.local");
  if (!existsSync(envLocal)) {
    fail("No .env.local (owner-acknowledged production mode reads it). Add the Supabase URL + service role key.");
  }
  const contents = readFileSync(envLocal, "utf-8");
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const line = contents.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    if (!line || line.slice(key.length + 1).trim() === "") fail(`.env.local is missing a value for ${key}.`);
  }
}

function run(cmd, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...extraEnv }, shell: process.platform === "win32" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForServer(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE_URL);
      if (res.status < 500) return true;
    } catch {
      /* not up */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  preflight();
  console.log(`[verify:p0-2] starting next dev on ${PORT} (AI_MODE=mock)`);
  const server = spawn("npx", ["next", "dev", "-p", PORT], {
    stdio: "inherit",
    env: { ...process.env, AI_MODE: "mock", PORT },
    shell: process.platform === "win32"
  });

  let exitCode = 0;
  try {
    if (!(await waitForServer())) fail(`server at ${BASE_URL} did not become ready`);
    const stepEnv = { BASE_URL, AI_MODE: "mock" };

    console.log("\n[verify:p0-2] === seed:test ===");
    if ((await run("node", ["scripts/seed-test.mjs"], stepEnv)) !== 0) throw new Error("seed:test failed");

    console.log("\n[verify:p0-2] === suite:jobs ===");
    const jobs = await run("node", ["scripts/suites/jobs.mjs"], stepEnv);
    console.log("\n[verify:p0-2] === suite:failure-fixtures ===");
    const fixtures = await run("node", ["scripts/suites/failure-fixtures.mjs"], stepEnv);
    console.log("\n[verify:p0-2] === suite:integrity ===");
    const integrity = await run("node", ["scripts/suites/integrity.mjs"], stepEnv);
    console.log("\n[verify:p0-2] === teardown:test ===");
    const teardown = await run("node", ["scripts/teardown-test.mjs"], stepEnv);
    console.log("\n[verify:p0-2] === check:residue ===");
    const residue = await run("node", ["scripts/check-test-residue.mjs"], stepEnv);

    exitCode = [jobs, fixtures, integrity, teardown, residue].some((c) => c !== 0) ? 1 : 0;
    console.log(
      `\n[verify:p0-2] result — jobs:${lbl(jobs)} fixtures:${lbl(fixtures)} integrity:${lbl(integrity)} ` +
        `teardown:${lbl(teardown)} residue:${lbl(residue)}`
    );
  } catch (error) {
    console.error(`[verify:p0-2] ${error instanceof Error ? error.message : error}`);
    exitCode = 1;
  } finally {
    server.kill("SIGTERM");
  }

  console.log(exitCode === 0 ? "\n[verify:p0-2] P0.2 API GATE GREEN ✓ (run suite:e2e for the browser durable-render proof)" : "\n[verify:p0-2] P0.2 GATE NOT GREEN ✗");
  process.exit(exitCode);
}

function lbl(code) {
  return code === 0 ? "PASS" : "FAIL";
}

main();
