import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * One-command P0.1 gate runner (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.1).
 *
 * Orchestrates the full cycle so closing the gate is a single step once
 * `.env.local` carries the Supabase credentials and migrations 007 + 008 are
 * applied to the project:
 *
 *   start next dev (AI_MODE=mock) -> seed:test -> suite:jobs -> suite:integrity
 *   -> teardown:test -> check:residue -> stop server
 *
 * Fails closed and loudly at each boundary; always tears the server down.
 *
 *   npm run verify:p0-1
 */

const PORT = process.env.VERIFY_PORT || "3131";
const BASE_URL = `http://localhost:${PORT}`;
const cwd = process.cwd();

function preflight() {
  const envLocal = path.join(cwd, ".env.local");
  if (!existsSync(envLocal)) {
    fail(
      "No .env.local found. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and " +
        "SUPABASE_SERVICE_ROLE_KEY (owner-acknowledged production mode reads .env.local)."
    );
  }
  const contents = readFileSync(envLocal, "utf-8");
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const line = contents.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    if (!line || line.slice(key.length + 1).trim() === "") {
      fail(`.env.local is missing a value for ${key}.`);
    }
  }
}

function fail(message) {
  console.error(`\n[verify:p0-1] FAIL CLOSED: ${message}`);
  process.exit(1);
}

function run(cmd, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
      shell: process.platform === "win32"
    });
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
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  preflight();

  console.log(`[verify:p0-1] starting next dev on ${PORT} (AI_MODE=mock)`);
  const server = spawn("npx", ["next", "dev", "-p", PORT], {
    stdio: "inherit",
    env: { ...process.env, AI_MODE: "mock", PORT },
    shell: process.platform === "win32"
  });

  let exitCode = 0;
  try {
    if (!(await waitForServer())) fail(`server at ${BASE_URL} did not become ready`);

    const stepEnv = { BASE_URL, AI_MODE: "mock" };

    console.log("\n[verify:p0-1] === seed:test ===");
    if ((await run("node", ["scripts/seed-test.mjs"], stepEnv)) !== 0) throw new Error("seed:test failed");

    console.log("\n[verify:p0-1] === suite:jobs ===");
    const jobsCode = await run("node", ["scripts/suites/jobs.mjs"], stepEnv);

    console.log("\n[verify:p0-1] === suite:integrity ===");
    const integrityCode = await run("node", ["scripts/suites/integrity.mjs"], stepEnv);

    console.log("\n[verify:p0-1] === teardown:test ===");
    const teardownCode = await run("node", ["scripts/teardown-test.mjs"], stepEnv);

    console.log("\n[verify:p0-1] === check:residue ===");
    const residueCode = await run("node", ["scripts/check-test-residue.mjs"], stepEnv);

    exitCode = [jobsCode, integrityCode, teardownCode, residueCode].some((c) => c !== 0) ? 1 : 0;

    console.log(
      `\n[verify:p0-1] result — jobs:${label(jobsCode)} integrity:${label(integrityCode)} ` +
        `teardown:${label(teardownCode)} residue:${label(residueCode)}`
    );
  } catch (error) {
    console.error(`[verify:p0-1] ${error instanceof Error ? error.message : error}`);
    exitCode = 1;
  } finally {
    server.kill("SIGTERM");
  }

  console.log(exitCode === 0 ? "\n[verify:p0-1] P0.1 GATE GREEN ✓" : "\n[verify:p0-1] P0.1 GATE NOT GREEN ✗");
  process.exit(exitCode);
}

function label(code) {
  return code === 0 ? "PASS" : "FAIL";
}

main();
