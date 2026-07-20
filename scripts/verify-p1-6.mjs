import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { loadTestEnv } from "./test-env.mjs";

const cwd = process.cwd();
const MATRIX_PATH = path.join(cwd, "reports", "p1-6-release-matrix.json");
const SUITES = {
  integrity: "scripts/suites/integrity.mjs",
  // Historical tabbed-workspace regression only. P1.6's committed functional
  // journey is p16HouseholdRelease; opt into this legacy suite explicitly.
  e2e: "scripts/suites/e2e.mjs",
  failureFixtures: "scripts/suites/failure-fixtures.mjs",
  p13FinishedImage: "scripts/suites/p13-finished-image.mjs",
  p13Revisions: "scripts/suites/p13-revisions.mjs",
  p14Implementation: "scripts/suites/p14-implementation-package.mjs",
  p15WholeHome: "scripts/suites/p15-whole-home.mjs",
  photoUploadDirect: "scripts/suites/photo-upload-direct.mjs",
  p16HouseholdRelease: "scripts/suites/p16-household-release.mjs"
};
const DEFAULT_SUITES = Object.keys(SUITES).filter((name) => name !== "e2e");

function selectedSuites() {
  const names = (process.env.P16_SUITES || DEFAULT_SUITES.join(",")).split(",").map((name) => name.trim()).filter(Boolean);
  const unknown = names.filter((name) => !SUITES[name]);
  if (unknown.length) throw new Error(`Unknown P16_SUITES value(s): ${unknown.join(", ")}`);
  return names;
}

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
  try { return JSON.parse(readFileSync(path.join(cwd, "test-runs", "current.json"), "utf8")).testRunId ?? null; } catch { return null; }
}

async function selectPort() {
  if (process.env.VERIFY_PORT) return process.env.VERIFY_PORT;
  for (let port = 3380; port < 3420; port += 1) {
    const available = await new Promise((resolve) => {
      const probe = net.createServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "::", () => probe.close(() => resolve(true)));
    });
    if (available) return String(port);
  }
  throw new Error("No P1.6 verification port is available in 3380-3419.");
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${baseUrl}/api/debug/env-fingerprint`)).status < 500) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Verification server at ${baseUrl} did not become ready.`);
}

async function stopServer(server) {
  if (!server?.pid) return;
  if (process.platform === "win32") await run("taskkill.exe", ["/pid", String(server.pid), "/T", "/F"]);
  else server.kill("SIGTERM");
}

function evaluateOwnerMatrix() {
  const matrix = JSON.parse(readFileSync(MATRIX_PATH, "utf8"));
  const rooms = matrix.per_room_evidence ?? [];
  const complete = rooms.length === 3 && rooms.every((room) => [
    room.room_label,
    room.room_type,
    room.phone_model,
    room.browser_and_version,
    room.active_intake_seconds,
    room.first_design_useful_enough_to_continue,
    room.revision_count,
    room.final_design_acceptable,
    room.final_visual_score_0_to_100,
    room.hard_preservation_failures,
    room.design_usefulness_1_to_10,
    room.architecture_confidence_1_to_10,
    room.implementation_package_usefulness_1_to_10,
    room.manual_refresh_count,
    room.duplicate_paid_generation_count,
    room.recovery_or_terminal_guidance_for_every_failure,
    room.provider_calls,
    room.provider_latency_ms,
    room.cost_estimate_usd
  ].every((value) => value !== null && value !== undefined));
  if (!complete) return { complete: false, pass: false, reason: "owner-scored phone/live room evidence is incomplete" };

  const sortedTimes = rooms.map((room) => room.active_intake_seconds).sort((a, b) => a - b);
  const pass = new Set(rooms.map((room) => room.room_type)).size === 3 &&
    sortedTimes[1] <= 120 &&
    rooms.filter((room) => room.first_design_useful_enough_to_continue).length >= 2 &&
    rooms.every((room) => room.revision_count <= 1 && room.final_design_acceptable === true && room.final_visual_score_0_to_100 >= 75 && room.hard_preservation_failures === 0 &&
      room.design_usefulness_1_to_10 >= 8 && room.architecture_confidence_1_to_10 >= 8 && room.implementation_package_usefulness_1_to_10 >= 8 &&
      room.manual_refresh_count === 0 && room.duplicate_paid_generation_count === 0 && room.recovery_or_terminal_guidance_for_every_failure === true) &&
    matrix.overall_owner_evidence?.workflow_clarity_1_to_10 >= 9 && matrix.overall_owner_evidence?.would_use_for_next_room === true;
  return { complete: true, pass, reason: pass ? "owner evidence passes" : "completed owner evidence does not meet the frozen contract" };
}

function writeReport({ environment, port, suites, results, residue, owner, error }) {
  const technicalPass = Object.values(results).every((code) => code === 0) && residue === "PASS" && !error;
  const finalStatus = technicalPass && owner.pass ? "PASS" : technicalPass ? "OWNER AND LIVE EVIDENCE PENDING" : "FAIL";
  const reportPath = path.join(cwd, "reports", `p1-6-gate-${Date.now()}-${commit()}.md`);
  const lines = [
    "# P1.6 Personal Household Release Gate", "",
    `- Commit: \`${commit()}\``,
    `- Environment mode: **${environment?.mode ?? "unknown"}**`,
    "- Automated AI mode: **mock**",
    `- Verification port: \`${port ?? "not started"}\``,
    `- Suites: ${suites.join(", ") || "none"}`,
    `- Typecheck: **${results.typecheck === 0 ? "PASS" : "FAIL"}**`,
    `- Production build: **${results.build === 0 ? "PASS" : "FAIL"}**`,
    `- Automated suite cycles: **${suites.every((name) => results[name] === 0) ? "PASS" : "FAIL"}**`,
    `- Tagged teardown/residue: **${residue}**`,
    `- Owner-scored phone/live matrix: **${owner.pass ? "PASS" : owner.complete ? "FAIL" : "PENDING"}**`,
    `- Final status: **${finalStatus}**`
  ];
  if (error) lines.push(`- Runner error: ${error}`);
  lines.push("", "Automated evidence never substitutes for the frozen three-room owner matrix. Live provider calls are not run by this command; the bounded plan requires explicit authorization and actual owner journeys.", "");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, lines.join("\n"), { flag: "wx" });
  console.log(`[verify:p1-6] immutable report: ${path.relative(cwd, reportPath)}`);
  return technicalPass;
}

async function main() {
  let environment;
  let port;
  let server;
  let residue = "NOT RUN";
  let errorMessage = null;
  const suites = selectedSuites();
  const results = {};
  const owner = evaluateOwnerMatrix();
  try {
    environment = loadTestEnv();
    results.typecheck = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run typecheck"]);
    results.build = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run build"]);
    if (results.typecheck !== 0 || results.build !== 0) throw new Error("Build prerequisites failed; mutation-capable suites were not started.");

    port = await selectPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.join(cwd, "node_modules/next/dist/bin/next"), "start", "-p", port], {
      cwd,
      stdio: "inherit",
      env: { ...process.env, AI_MODE: "mock", BASE_URL: baseUrl, PORT: port },
      shell: false
    });
    await waitForServer(baseUrl);

    for (const name of suites) {
      const cycleEnv = { BASE_URL: baseUrl, AI_MODE: "mock" };
      results[`${name}:seed`] = await run(process.execPath, ["scripts/seed-test.mjs"], cycleEnv);
      const runId = results[`${name}:seed`] === 0 ? seededRunId() : null;
      results[name] = results[`${name}:seed`] === 0 ? await run(process.execPath, [SUITES[name]], cycleEnv) : 1;
      results[`${name}:teardown`] = await run(process.execPath, ["scripts/teardown-test.mjs", ...(runId ? [runId] : [])], cycleEnv);
      results[`${name}:residue`] = await run(process.execPath, ["scripts/check-test-residue.mjs"], cycleEnv);
    }
    residue = Object.entries(results).some(([name, code]) => (name.endsWith(":teardown") || name.endsWith(":residue")) && code !== 0) ? "FAIL" : "PASS";
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[verify:p1-6] FAIL CLOSED: ${errorMessage}`);
  } finally {
    await stopServer(server);
    const technicalPass = writeReport({ environment, port, suites, results, residue, owner, error: errorMessage });
    process.exitCode = technicalPass ? 0 : 1;
  }
}

main().catch((error) => {
  console.error(`[verify:p1-6] FAIL CLOSED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
