import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/**
 * Every suite assumes `npm run seed:test` has already produced
 * test-runs/current.json for this cycle (PRD v3 §12.4 cycle discipline: a
 * fresh seed precedes every suite run, never dirty state).
 */
export function readCurrentTestRun() {
  const statePath = path.join(process.cwd(), "test-runs", "current.json");
  if (!existsSync(statePath)) {
    throw new Error("No test-runs/current.json found. Run `npm run seed:test` before any suite.");
  }
  return JSON.parse(readFileSync(statePath, "utf-8"));
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, ok: response.ok, body };
}

export async function getRoomState(roomId) {
  const { ok, status, body } = await fetchJson(`${BASE_URL}/api/debug/room-state/${roomId}`);
  if (!ok) throw new Error(`debug/room-state failed (${status}): ${JSON.stringify(body)}`);
  return body;
}

/**
 * Minimal shared reporter so every suite prints the same pass/fail shape and
 * writes a machine-readable result the release report / cycle runner can
 * aggregate across suites without re-parsing console output.
 */
export class SuiteReporter {
  constructor(name) {
    this.name = name;
    this.checks = [];
    this.startedAt = Date.now();
  }

  assert(condition, description, detail) {
    const passed = Boolean(condition);
    this.checks.push({ description, passed, detail: passed ? undefined : detail });
    console.log(`${passed ? "PASS" : "FAIL"} - ${description}${passed ? "" : ` :: ${JSON.stringify(detail)}`}`);
    return passed;
  }

  get failed() {
    return this.checks.filter((check) => !check.passed);
  }

  finish() {
    const durationMs = Date.now() - this.startedAt;
    const result = {
      suite: this.name,
      ranAt: new Date().toISOString(),
      durationMs,
      total: this.checks.length,
      passed: this.checks.length - this.failed.length,
      failed: this.failed.length,
      checks: this.checks
    };

    const dir = path.join(process.cwd(), "test-runs", "suite-results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${this.name}.json`), JSON.stringify(result, null, 2));

    console.log(
      `\n[${this.name}] ${result.passed}/${result.total} passed in ${durationMs}ms` +
        (result.failed ? ` — ${result.failed} FAILED` : "")
    );

    if (result.failed > 0) {
      process.exitCode = 1;
    }
    return result;
  }
}

export async function waitForServer(url = BASE_URL, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return true;
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms.`);
}
