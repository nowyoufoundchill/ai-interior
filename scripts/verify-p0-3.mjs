import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * One-command P0.3 gate runner (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.3).
 *
 * Starts one AI_MODE=mock dev server, then runs the P0.3 gate against FRESH
 * seeds (§12.4 — never verify against dirty state):
 *
 *   [seed] -> suite:render-batches -> teardown -> residue   (the batch gate)
 *   [seed] -> suite:integrity      -> teardown -> residue   (invalidation regression)
 *   [seed] -> suite:e2e            -> teardown -> residue   (browser journey regression)
 *
 * Each suite gets its own clean seed. Fails closed and loudly at each boundary;
 * always tears the server down.
 *
 *   npm run verify:p0-3
 */

const PORT = process.env.VERIFY_PORT || "3133";
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
  console.error(`\n[verify:p0-3] FAIL CLOSED: ${message}`);
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

async function cycle(name, suiteScript, stepEnv, codes) {
  console.log(`\n[verify:p0-3] === seed:test (${name}) ===`);
  if ((await run("node", ["scripts/seed-test.mjs"], stepEnv)) !== 0) throw new Error(`seed:test (${name}) failed`);

  console.log(`\n[verify:p0-3] === suite:${name} ===`);
  codes[name] = await run("node", [suiteScript], stepEnv);

  console.log(`\n[verify:p0-3] === teardown:test (${name}) ===`);
  codes[`teardown_${name}`] = await run("node", ["scripts/teardown-test.mjs"], stepEnv);
  console.log(`\n[verify:p0-3] === check:residue (${name}) ===`);
  codes[`residue_${name}`] = await run("node", ["scripts/check-test-residue.mjs"], stepEnv);
}

async function main() {
  preflight();

  console.log(`[verify:p0-3] starting next dev on ${PORT} (AI_MODE=mock)`);
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

    await cycle("render-batches", "scripts/suites/render-batches.mjs", stepEnv, codes);
    await cycle("integrity", "scripts/suites/integrity.mjs", stepEnv, codes);
    await cycle("e2e", "scripts/suites/e2e.mjs", stepEnv, codes);

    exitCode = Object.values(codes).some((c) => c !== 0) ? 1 : 0;

    console.log(
      `\n[verify:p0-3] result — render-batches:${label(codes["render-batches"])} integrity:${label(codes.integrity)} ` +
        `e2e:${label(codes.e2e)} teardown:${label(codes["teardown_render-batches"])}/${label(codes.teardown_integrity)}/${label(codes.teardown_e2e)} ` +
        `residue:${label(codes["residue_render-batches"])}/${label(codes.residue_integrity)}/${label(codes.residue_e2e)}`
    );
  } catch (error) {
    console.error(`[verify:p0-3] ${error instanceof Error ? error.message : error}`);
    exitCode = 1;
  } finally {
    server.kill("SIGTERM");
  }

  console.log(exitCode === 0 ? "\n[verify:p0-3] P0.3 GATE GREEN ✓" : "\n[verify:p0-3] P0.3 GATE NOT GREEN ✗");
  process.exit(exitCode);
}

function label(code) {
  return code === 0 ? "PASS" : "FAIL";
}

main();
