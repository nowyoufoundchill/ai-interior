import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { loadTestEnv } from "./test-env.mjs";

const cwd = process.cwd();
const cycles = [
  { name: "finished-image", suite: "scripts/suites/p13-finished-image.mjs" },
  { name: "revisions", suite: "scripts/suites/p13-revisions.mjs" }
];

function run(command, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", env: { ...process.env, ...env }, shell: false });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function commit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function seededRunId() {
  try {
    return JSON.parse(readFileSync(path.join(cwd, "test-runs/current.json"), "utf8")).testRunId ?? null;
  } catch {
    return null;
  }
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "::", () => probe.close(() => resolve(true)));
  });
}

async function selectPort() {
  for (let port = 3230; port < 3290; port += 1) if (await portAvailable(port)) return String(port);
  throw new Error("No P1.3 verification port is available in 3230-3289.");
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

async function stopServer(server) {
  if (!server?.pid) return;
  if (process.platform === "win32") {
    await run("taskkill.exe", ["/pid", String(server.pid), "/T", "/F"]);
    return;
  }
  server.kill("SIGTERM");
}

function writeReport({ environment, port, results, residue, error }) {
  const corpus = JSON.parse(readFileSync(path.join(cwd, "lib/ai/fixtures/p1-3-finished-image-corpus.json"), "utf8"));
  const finalStatus = Object.values(results).every((code) => code === 0) && residue === "PASS" && !error ? "PASS" : "FAIL";
  const reportPath = path.join(cwd, "reports", `p1-3-gate-${Date.now()}-${commit()}.md`);
  const lines = [
    "# P1.3 Finished-image Quality and Refinement Gate",
    "",
    `- Commit: \`${commit()}\``,
    `- Environment mode: **${environment?.mode ?? "unknown"}**`,
    `- AI mode: **mock**`,
    `- Frozen corpus: \`${corpus.version}\` (${corpus.critical_cases.length} critical cases, ${corpus.known_good_controls.length} known-good controls)`,
    `- Owner revision scenarios: **5**`,
    `- Verification port: \`${port ?? "not started"}\``,
    `- Typecheck: **${results.typecheck === 0 ? "PASS" : "FAIL"}**`,
    `- Build: **${results.build === 0 ? "PASS" : "FAIL"}**`,
    `- Seeded finished-image suite: **${results["finished-image"] === 0 ? "PASS" : "FAIL"}**`,
    `- Browser revision journey: **${results.revisions === 0 ? "PASS" : "FAIL"}**`,
    `- Tagged teardown/residue: **${residue}**`,
    `- Final status: **${finalStatus}**`
  ];
  if (error) lines.push(`- Runner error: ${error}`);
  lines.push("", "The gate uses deterministic provider fixtures. It proves review classification, blocking, bounded repair, append-only persistence, browser submission, and refresh behavior without paid provider calls or public benchmark assets.", "");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, lines.join("\n"), { flag: "wx" });
  console.log(`[verify:p1-3] immutable report: ${path.relative(cwd, reportPath)}`);
  return finalStatus;
}

async function main() {
  let environment;
  let port;
  let server;
  let residue = "NOT RUN";
  let runnerError = null;
  const results = {};
  try {
    environment = loadTestEnv();
    results.typecheck = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run typecheck"]);
    results.build = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run build"]);
    if (results.typecheck !== 0 || results.build !== 0) throw new Error("Build prerequisites failed; tagged suites were not started.");

    port = await selectPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.join(cwd, "node_modules/next/dist/bin/next"), "start", "-p", port], {
      cwd,
      stdio: "inherit",
      env: { ...process.env, AI_MODE: "mock", BASE_URL: baseUrl, PORT: port },
      shell: false
    });
    if (!(await waitForServer(baseUrl))) throw new Error(`Verification server at ${baseUrl} did not become ready.`);

    let residueFailed = false;
    for (const cycle of cycles) {
      const cycleEnv = { BASE_URL: baseUrl, AI_MODE: "mock" };
      let runId = null;
      const seedCode = await run(process.execPath, ["scripts/seed-test.mjs"], cycleEnv);
      results[`${cycle.name}:seed`] = seedCode;
      if (seedCode === 0) runId = seededRunId();
      results[cycle.name] = seedCode === 0 ? await run(process.execPath, [cycle.suite], cycleEnv) : 1;
      results[`${cycle.name}:teardown`] = await run(process.execPath, ["scripts/teardown-test.mjs", ...(runId ? [runId] : [])], cycleEnv);
      results[`${cycle.name}:residue`] = await run(process.execPath, ["scripts/check-test-residue.mjs"], cycleEnv);
      if (results[`${cycle.name}:teardown`] !== 0 || results[`${cycle.name}:residue`] !== 0) residueFailed = true;
    }
    residue = residueFailed ? "FAIL" : "PASS";
  } catch (error) {
    runnerError = error instanceof Error ? error.message : String(error);
    console.error(`[verify:p1-3] FAIL CLOSED: ${runnerError}`);
  } finally {
    await stopServer(server);
    const finalStatus = writeReport({ environment, port, results, residue, error: runnerError });
    process.exitCode = finalStatus === "PASS" ? 0 : 1;
  }
}

main().catch((error) => {
  console.error(`[verify:p1-3] FAIL CLOSED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
