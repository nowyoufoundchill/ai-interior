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
