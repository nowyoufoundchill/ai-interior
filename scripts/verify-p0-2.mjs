import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * One-command P0.2 gate runner (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.2).
 *
 * Starts one AI_MODE=mock dev server, then runs the P0.2 gate against FRESH
 * seeds (§12.4 — never verify against dirty state):
 *
 *   [seed] -> suite:render-jobs -> suite:failure-fixtures -> teardown -> residue
 *   [seed] -> suite:integrity   -> teardown -> residue
 *
 * render-jobs + failure-fixtures deliberately share one seed: render-jobs leaves
 * a current render that failure-fixtures' precondition needs. Integrity requires
 * a clean baseline, so it gets its own seed. Fails closed and loudly at each
 * boundary; always tears the server down.
 *
 *   npm run verify:p0-2
 */

const PORT = process.env.VERIFY_PORT || "3132";
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
  console.error(`\n[verify:p0-2] FAIL CLOSED: ${message}`);
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

  console.log(`[verify:p0-2] starting next dev on ${PORT} (AI_MODE=mock)`);
  const server = spawn("npx", ["next", "dev", "-p", PORT], {
    stdio: "inherit",
    env: { ...process.env, AI_MODE: "mock", PORT },
    shell: process.platform === "win32"
  });

  const stepEnv = { BASE_URL, AI_MODE: "mock" };
  const codes = {};
  let exitCode = 0;

  try {
    if (!(await waitForServer())) fail(`server at ${BASE_URL} did not become ready`);

    // --- Cycle 1: render-jobs + failure-fixtures share one fresh seed --------
    console.log("\n[verify:p0-2] === seed:test (cycle 1) ===");
    if ((await run("node", ["scripts/seed-test.mjs"], stepEnv)) !== 0) throw new Error("seed:test (1) failed");

    console.log("\n[verify:p0-2] === suite:render-jobs ===");
    codes.renderJobs = await run("node", ["scripts/suites/render-jobs.mjs"], stepEnv);

    console.log("\n[verify:p0-2] === suite:failure-fixtures ===");
    codes.failureFixtures = await run("node", ["scripts/suites/failure-fixtures.mjs"], stepEnv);

    console.log("\n[verify:p0-2] === teardown:test (cycle 1) ===");
    codes.teardown1 = await run("node", ["scripts/teardown-test.mjs"], stepEnv);
    console.log("\n[verify:p0-2] === check:residue (cycle 1) ===");
    codes.residue1 = await run("node", ["scripts/check-test-residue.mjs"], stepEnv);

    // --- Cycle 2: integrity regression on a clean baseline ------------------
    console.log("\n[verify:p0-2] === seed:test (cycle 2) ===");
    if ((await run("node", ["scripts/seed-test.mjs"], stepEnv)) !== 0) throw new Error("seed:test (2) failed");

    console.log("\n[verify:p0-2] === suite:integrity ===");
    codes.integrity = await run("node", ["scripts/suites/integrity.mjs"], stepEnv);

    console.log("\n[verify:p0-2] === teardown:test (cycle 2) ===");
    codes.teardown2 = await run("node", ["scripts/teardown-test.mjs"], stepEnv);
    console.log("\n[verify:p0-2] === check:residue (cycle 2) ===");
    codes.residue2 = await run("node", ["scripts/check-test-residue.mjs"], stepEnv);

    exitCode = Object.values(codes).some((c) => c !== 0) ? 1 : 0;

    console.log(
      `\n[verify:p0-2] result — render-jobs:${label(codes.renderJobs)} failure-fixtures:${label(codes.failureFixtures)} ` +
        `integrity:${label(codes.integrity)} teardown:${label(codes.teardown1)}/${label(codes.teardown2)} ` +
        `residue:${label(codes.residue1)}/${label(codes.residue2)}`
    );
  } catch (error) {
    console.error(`[verify:p0-2] ${error instanceof Error ? error.message : error}`);
    exitCode = 1;
  } finally {
    server.kill("SIGTERM");
  }

  console.log(exitCode === 0 ? "\n[verify:p0-2] P0.2 GATE GREEN ✓" : "\n[verify:p0-2] P0.2 GATE NOT GREEN ✗");
  process.exit(exitCode);
}

function label(code) {
  return code === 0 ? "PASS" : "FAIL";
}

main();
