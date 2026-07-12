import { spawn } from "node:child_process";
import { loadTestEnv } from "./test-env.mjs";

/**
 * Starts the Next.js dev server bound to the TEST Supabase project (P0.0).
 *
 * Next.js loads .env.local on its own, but explicit process env always wins —
 * loadTestEnv() applies every .env.test var to process.env (fail-closed: it
 * throws when .env.test is missing or resolves to production), so the server
 * this spawns writes to the test project no matter what .env.local says.
 * Suites verify that via GET /api/debug/env-fingerprint before mutating.
 *
 * AI_MODE: defaults to whatever .env.test sets (mock, per the example file).
 * Override per-run for Suite 3: `AI_MODE=live npm run dev:test` — vars already
 * in the process environment are never overwritten by loadTestEnv().
 */
loadTestEnv();

// Safety default: a bare `npm run dev:test` must never silently drive LIVE
// (paid) provider calls. gateway.ts treats anything but "mock" as live, and
// .env.test does not set AI_MODE, so default it here when unset. An explicit
// `AI_MODE=live npm run dev:test` (Suite 3) still wins — loadTestEnv() and this
// guard both leave an already-set process var untouched.
if (!process.env.AI_MODE) {
  process.env.AI_MODE = "mock";
}

const port = process.env.PORT || "3000";
console.log(`[dev-test] starting next dev on port ${port} (AI_MODE=${process.env.AI_MODE ?? "unset"})`);

const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32"
});

child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
