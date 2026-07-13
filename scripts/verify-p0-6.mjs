import { spawn } from "node:child_process";
import { loadTestEnv } from "./test-env.mjs";

/** P0.6 automated release gate: fresh seed -> suite -> teardown -> residue. */
const PORT = process.env.VERIFY_PORT || "3136";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const cwd = process.cwd();
const SUITES = {
  integrity: "scripts/suites/integrity.mjs",
  failureFixtures: "scripts/suites/failure-fixtures.mjs",
  renderBatches: "scripts/suites/render-batches.mjs",
  chatActions: "scripts/suites/chat-actions.mjs",
  e2e: "scripts/suites/e2e.mjs",
  p05Browser: "scripts/suites/p05-browser.mjs",
  assetsResponsive: "scripts/suites/assets-responsive.mjs"
};

function selectedSuites() {
  const requested = (process.env.P06_SUITES || Object.keys(SUITES).join(",")).split(",").map((name) => name.trim()).filter(Boolean);
  const unknown = requested.filter((name) => !SUITES[name]);
  if (unknown.length) throw new Error(`Unknown P06_SUITES value(s): ${unknown.join(", ")}`);
  return requested;
}

function run(command, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", env: { ...process.env, ...env }, shell: false });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForServer(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/debug/env-fingerprint`);
      if (response.status < 500) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  loadTestEnv();
  const results = {};
  results.typecheck = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run typecheck"]);
  results.build = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run build"]);
  if (results.typecheck !== 0 || results.build !== 0) {
    console.error("[verify:p0-6] FAIL CLOSED: build prerequisites failed; no mutation-capable suites were started.");
    process.exitCode = 1;
    return;
  }

  const serverCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const server = spawn(serverCommand, ["next", "start", "-p", PORT], { cwd, stdio: "inherit", env: { ...process.env, AI_MODE: "mock", BASE_URL, PORT }, shell: true });
  try {
    if (!(await waitForServer())) throw new Error(`test server at ${BASE_URL} did not become ready`);
    for (const name of selectedSuites()) {
      results[`${name}:seed`] = await run(process.execPath, ["scripts/seed-test.mjs"], { BASE_URL, AI_MODE: "mock" });
      results[name] = results[`${name}:seed`] === 0
        ? await run(process.execPath, [SUITES[name]], { BASE_URL, AI_MODE: "mock" })
        : 1;
      results[`${name}:teardown`] = await run(process.execPath, ["scripts/teardown-test.mjs"], { BASE_URL, AI_MODE: "mock" });
      results[`${name}:residue`] = await run(process.execPath, ["scripts/check-test-residue.mjs"], { BASE_URL, AI_MODE: "mock" });
    }
  } finally {
    server.kill("SIGTERM");
  }
  const failed = Object.entries(results).filter(([, code]) => code !== 0);
  console.log(`\n[verify:p0-6] ${failed.length ? "GATE NOT GREEN" : "GATE GREEN"}`);
  console.log(`[verify:p0-6] ${Object.entries(results).map(([name, code]) => `${name}:${code === 0 ? "PASS" : "FAIL"}`).join(" ")}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error(`[verify:p0-6] FAIL CLOSED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
