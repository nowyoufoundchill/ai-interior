import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { loadTestEnv } from "./test-env.mjs";

/** P0.6 automated release gate: fresh seed -> suite -> teardown -> residue. */
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

function gitShortCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    // Next binds the wildcard host on Windows; probing only 127.0.0.1 can
    // incorrectly report a port as free while :::port is already occupied.
    probe.listen(port, "::", () => probe.close(() => resolve(true)));
  });
}

async function selectPort() {
  if (process.env.VERIFY_PORT) return process.env.VERIFY_PORT;
  for (let port = 3136; port < 3200; port += 1) {
    if (await portAvailable(port)) return String(port);
  }
  throw new Error("no available verification port in 3136-3199; set VERIFY_PORT explicitly");
}

function writeGateReport({ mode, suites, results, residue, finalStatus, error, port }) {
  const commit = gitShortCommit();
  const timestamp = Date.now();
  const reportPath = path.join(cwd, "reports", `p0-6-gate-${timestamp}-${commit}.md`);
  const failures = Object.entries(results).filter(([, code]) => code !== 0).map(([name]) => name);
  const retries = Object.entries(results)
    .filter(([name]) => name.endsWith(":retry"))
    .map(([name, code]) => `${name}=${code === 0 ? "PASS" : "FAIL"}`);
  const lines = [
    "# P0.6 Gate Report",
    "",
    `- Commit: \`${commit}\``,
    `- Environment mode: **${mode ?? "unknown"}**`,
    `- Suites: ${suites.length ? suites.join(", ") : "none"}`,
    `- Verification port: \`${port ?? "not started"}\``,
    `- Failures: ${failures.length ? failures.join(", ") : "none"}`,
    `- Retries: ${retries.length ? retries.join(", ") : "none reported by runner"}`,
    `- Residue: **${residue ?? "not run"}**`,
    `- Final status: **${finalStatus}**`
  ];
  if (error) lines.push(`- Runner error: ${error}`);
  lines.push("");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${lines.join("\n")}\n`, { flag: "wx" });
  console.log(`[verify:p0-6] immutable report: ${path.relative(cwd, reportPath)}`);
}

function seededTestRunId() {
  try {
    return JSON.parse(readFileSync(path.join(cwd, "test-runs", "current.json"), "utf8")).testRunId ?? null;
  } catch {
    return null;
  }
}

async function waitForServer(baseUrl, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/debug/env-fingerprint`);
      if (response.status < 500) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  let environment;
  let suites = [];
  let port;
  const results = {};
  let server;
  let residue = "not run";
  let finalStatus = "FAIL";
  let runnerError;
  try {
    environment = loadTestEnv();
    suites = selectedSuites();
    port = await selectPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    results.typecheck = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run typecheck"]);
    results.build = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run build"]);
    if (results.typecheck !== 0 || results.build !== 0) {
      throw new Error("build prerequisites failed; no mutation-capable suites were started");
    }

    const serverCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    server = spawn(serverCommand, ["next", "start", "-p", port], { cwd, stdio: "inherit", env: { ...process.env, AI_MODE: "mock", BASE_URL: baseUrl, PORT: port }, shell: true });
    if (!(await waitForServer(baseUrl))) throw new Error(`test server at ${baseUrl} did not become ready`);
    for (const name of suites) {
      results[`${name}:seed`] = await run(process.execPath, ["scripts/seed-test.mjs"], { BASE_URL: baseUrl, AI_MODE: "mock" });
      const testRunId = results[`${name}:seed`] === 0 ? seededTestRunId() : null;
      results[name] = results[`${name}:seed`] === 0
        ? await run(process.execPath, [SUITES[name]], { BASE_URL: baseUrl, AI_MODE: "mock" })
        : 1;
      const teardownArgs = ["scripts/teardown-test.mjs", ...(testRunId ? [testRunId] : [])];
      results[`${name}:teardown`] = await run(process.execPath, teardownArgs, { BASE_URL: baseUrl, AI_MODE: "mock" });
      results[`${name}:residue`] = await run(process.execPath, ["scripts/check-test-residue.mjs"], { BASE_URL: baseUrl, AI_MODE: "mock" });
    }
    residue = Object.entries(results).some(([name, code]) => name.endsWith(":residue") && code !== 0) ? "FAIL" : "PASS";
    const failed = Object.entries(results).filter(([, code]) => code !== 0);
    finalStatus = failed.length ? "FAIL" : "PASS";
    console.log(`\n[verify:p0-6] ${failed.length ? "GATE NOT GREEN" : "GATE GREEN"}`);
    console.log(`[verify:p0-6] ${Object.entries(results).map(([name, code]) => `${name}:${code === 0 ? "PASS" : "FAIL"}`).join(" ")}`);
    process.exitCode = failed.length ? 1 : 0;
  } catch (error) {
    runnerError = error instanceof Error ? error.message : String(error);
    console.error(`[verify:p0-6] FAIL CLOSED: ${runnerError}`);
    process.exitCode = 1;
  } finally {
    if (server) server.kill("SIGTERM");
    writeGateReport({ mode: environment?.mode, suites, results, residue, finalStatus, error: runnerError, port });
  }
}

main().catch((error) => {
  console.error(`[verify:p0-6] FAIL CLOSED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
