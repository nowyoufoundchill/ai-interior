import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
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

async function selectPort() {
  for (let port = 3340; port < 3380; port += 1) {
    const available = await new Promise((resolve) => {
      const probe = net.createServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "::", () => probe.close(() => resolve(true)));
    });
    if (available) return String(port);
  }
  throw new Error("No P1.5 verification port is available in 3340-3379.");
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

async function acceptedRealRooms() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("renders")
    .select("room_id, rooms!inner(name, room_type, test_run_id)")
    .eq("status", "accepted")
    .is("rooms.test_run_id", null);
  if (error) throw error;
  return [...new Map((data ?? []).map((item) => [item.room_id, item.rooms])).values()];
}

function writeReport({ environment, port, residue, realRooms, error }) {
  const technicalPass = Object.values(results).every((code) => code === 0) && residue === "PASS" && !error;
  const realRoomPass = realRooms.length >= 3;
  const finalStatus = technicalPass && realRoomPass ? "PASS" : technicalPass ? "REAL-ROOM ACCEPTANCE PENDING" : "FAIL";
  const reportPath = path.join(cwd, "reports", `p1-5-gate-${Date.now()}-${commit()}.md`);
  const lines = [
    "# P1.5 Whole-home Continuity Gate", "",
    `- Commit: \`${commit()}\``,
    `- Environment mode: **${environment?.mode ?? "unknown"}**`,
    "- AI mode: **mock**",
    `- Verification port: \`${port ?? "not started"}\``,
    `- Typecheck: **${results.typecheck === 0 ? "PASS" : "FAIL"}**`,
    `- Scoped continuity logic: **${results.logic === 0 ? "PASS" : "FAIL"}**`,
    `- Production build: **${results.build === 0 ? "PASS" : "FAIL"}**`,
    `- Six-room browser/data gate: **${results.suite === 0 ? "PASS" : "FAIL"}**`,
    `- Tagged teardown/residue: **${residue}**`,
    `- Accepted untagged real rooms: **${realRooms.length}/3${realRoomPass ? " PASS" : ""}**`,
    `- Final status: **${finalStatus}**`
  ];
  if (realRooms.length) lines.push(`- Accepted room evidence: ${realRooms.map((room) => room.room_type || room.name).join(", ")}`);
  if (error) lines.push(`- Runner error: ${error}`);
  lines.push(
    "",
    realRoomPass
      ? "The automated gate verifies scoped shared decisions across three room types, room-only exception isolation, six persisted lifecycle states, correct source/result binding, one-tap next actions, reload persistence, zero cross-room artifact/job leakage, browser health, and zero tagged residue. The read-only real-room threshold is satisfied by owner-accepted designs; the runner did not synthesize acceptance."
      : "The automated gate verifies scoped shared decisions across three room types, room-only exception isolation, six persisted lifecycle states, correct source/result binding, one-tap next actions, reload persistence, zero cross-room artifact/job leakage, browser health, and zero tagged residue. The remaining real-room threshold is owner evidence and is never synthesized by this runner.",
    ""
  );
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, lines.join("\n"), { flag: "wx" });
  console.log(`[verify:p1-5] immutable report: ${path.relative(cwd, reportPath)}`);
  return technicalPass;
}

async function main() {
  let environment;
  let port;
  let server;
  let runId;
  let residue = "NOT RUN";
  let runnerError = null;
  let realRooms = [];
  try {
    environment = loadTestEnv();
    realRooms = await acceptedRealRooms();
    results.typecheck = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run typecheck"]);
    results.logic = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run suite:p15-continuity-logic"]);
    results.build = await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run build"]);
    if ([results.typecheck, results.logic, results.build].some((code) => code !== 0)) throw new Error("Build prerequisites failed; tagged suite was not started.");
    port = await selectPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.join(cwd, "node_modules/next/dist/bin/next"), "start", "-p", port], {
      cwd, stdio: "inherit", env: { ...process.env, AI_MODE: "mock", BASE_URL: baseUrl, PORT: port }, shell: false
    });
    await waitForServer(baseUrl);
    const cycleEnv = { BASE_URL: baseUrl, AI_MODE: "mock" };
    results.seed = await run(process.execPath, ["scripts/seed-test.mjs"], cycleEnv);
    if (results.seed === 0) runId = seededRunId();
    results.suite = results.seed === 0 ? await run(process.execPath, ["scripts/suites/p15-whole-home.mjs"], cycleEnv) : 1;
    results.teardown = await run(process.execPath, ["scripts/teardown-test.mjs", ...(runId ? [runId] : [])], cycleEnv);
    results.residue = await run(process.execPath, ["scripts/check-test-residue.mjs"], cycleEnv);
    residue = results.teardown === 0 && results.residue === 0 ? "PASS" : "FAIL";
  } catch (error) {
    runnerError = error instanceof Error ? error.message : String(error);
    console.error(`[verify:p1-5] FAIL CLOSED: ${runnerError}`);
  } finally {
    await stopServer(server);
    const technicalPass = writeReport({ environment, port, residue, realRooms, error: runnerError });
    process.exitCode = technicalPass ? 0 : 1;
  }
}

main().catch((error) => {
  console.error(`[verify:p1-5] FAIL CLOSED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
