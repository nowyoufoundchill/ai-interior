import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { loadTestEnv } from "./test-env.mjs";

const cwd = process.cwd();
const results = {};

function run(command, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", env: { ...process.env, ...env }, shell: false });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function commit() {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8" }).trim(); } catch { return "unknown"; }
}

function seededRunId() {
  try { return JSON.parse(readFileSync(path.join(cwd, "test-runs/current.json"), "utf8")).testRunId ?? null; } catch { return null; }
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "::", () => probe.close(() => resolve(true)));
  });
}

async function selectPort() {
  for (let port = 3290; port < 3340; port += 1) if (await portAvailable(port)) return String(port);
  throw new Error("No P1.4 verification port is available in 3290-3339.");
}

async function waitForServer(baseUrl, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(`${baseUrl}/api/debug/env-fingerprint`); if (response.status < 500) return true; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function stopServer(server) {
  if (!server?.pid) return;
  if (process.platform === "win32") await run("taskkill.exe", ["/pid", String(server.pid), "/T", "/F"]);
  else server.kill("SIGTERM");
}

function writeReport({ environment, port, residue, error }) {
  const rating = Number(process.env.P14_OWNER_USEFULNESS_RATING);
  const ownerAccepted = Number.isFinite(rating) && rating >= 8;
  const technicalPass = Object.values(results).every((code) => code === 0) && residue === "PASS" && !error;
  const finalStatus = technicalPass && ownerAccepted ? "PASS" : technicalPass ? "OWNER ACCEPTANCE PENDING" : "FAIL";
  const reportPath = path.join(cwd, "reports", `p1-4-gate-${Date.now()}-${commit()}.md`);
  const lines = [
    "# P1.4 Implementation-ready Room Package Gate", "",
    `- Commit: \`${commit()}\``,
    `- Environment mode: **${environment?.mode ?? "unknown"}**`,
    "- AI mode: **mock**",
    `- Verification port: \`${port ?? "not started"}\``,
    `- Typecheck: **${results.typecheck === 0 ? "PASS" : "FAIL"}**`,
    `- Build: **${results.build === 0 ? "PASS" : "FAIL"}**`,
    `- Implementation package browser/data gate: **${results.suite === 0 ? "PASS" : "FAIL"}**`,
    `- Tagged teardown/residue: **${residue}**`,
    `- Owner usefulness rating: **${ownerAccepted ? `${rating}/10 PASS` : "not recorded"}**`,
    `- Final status: **${finalStatus}**`
  ];
  if (error) lines.push(`- Runner error: ${error}`);
  lines.push("", "The automated gate verifies accepted-render binding, append-only invalidation, provenance, field checks, schedule coverage, classified sourcing links, budget reconciliation, browser persistence, and zero tagged residue. Owner usefulness remains a separate required judgment.", "");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, lines.join("\n"), { flag: "wx" });
  console.log(`[verify:p1-4] immutable report: ${path.relative(cwd, reportPath)}`);
  return finalStatus;
}

async function main() {
  let environment;
  let port;
  let server;
  let runId = null;
  let residue = "NOT RUN";
  let runnerError = null;
  try {
    environment = loadTestEnv();
    results.typecheck = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run typecheck"]);
    results.build = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run build"]);
    if (results.typecheck !== 0 || results.build !== 0) throw new Error("Build prerequisites failed; tagged suite was not started.");
    port = await selectPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.join(cwd, "node_modules/next/dist/bin/next"), "start", "-p", port], {
      cwd, stdio: "inherit", env: { ...process.env, AI_MODE: "mock", BASE_URL: baseUrl, PORT: port }, shell: false
    });
    if (!(await waitForServer(baseUrl))) throw new Error(`Verification server at ${baseUrl} did not become ready.`);
    const cycleEnv = { BASE_URL: baseUrl, AI_MODE: "mock" };
    results.seed = await run(process.execPath, ["scripts/seed-test.mjs"], cycleEnv);
    if (results.seed === 0) runId = seededRunId();
    results.suite = results.seed === 0 ? await run(process.execPath, ["scripts/suites/p14-implementation-package.mjs"], cycleEnv) : 1;
    results.teardown = await run(process.execPath, ["scripts/teardown-test.mjs", ...(runId ? [runId] : [])], cycleEnv);
    results.residue = await run(process.execPath, ["scripts/check-test-residue.mjs"], cycleEnv);
    residue = results.teardown === 0 && results.residue === 0 ? "PASS" : "FAIL";
  } catch (error) {
    runnerError = error instanceof Error ? error.message : String(error);
    console.error(`[verify:p1-4] FAIL CLOSED: ${runnerError}`);
  } finally {
    await stopServer(server);
    const status = writeReport({ environment, port, residue, error: runnerError });
    process.exitCode = status === "PASS" ? 0 : 1;
  }
}

main().catch((error) => {
  console.error(`[verify:p1-4] FAIL CLOSED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
