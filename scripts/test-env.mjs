import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Loads .env.test (a dedicated test Supabase project, per PRD v3 §3) if it
 * exists; otherwise falls back to .env.local and prints a loud warning, since
 * that means test suites run against the same project as production and the
 * residue check (scripts/check-test-residue.mjs) is not optional cleanup —
 * it is the only thing standing between test runs and polluted prod data.
 */
export function loadTestEnv() {
  const testEnvPath = path.join(process.cwd(), ".env.test");
  const localEnvPath = path.join(process.cwd(), ".env.local");

  if (existsSync(testEnvPath)) {
    applyEnvFile(testEnvPath);
    console.log("[test-env] Loaded .env.test (dedicated test project).");
    return { usingDedicatedTestProject: true };
  }

  if (existsSync(localEnvPath)) {
    applyEnvFile(localEnvPath);
    console.warn(
      "[test-env] WARNING: .env.test not found — falling back to .env.local. " +
      "Test runs will hit the SAME Supabase project as production. " +
      "Every row/object this cycle creates MUST be tagged with test_run_id and torn down; " +
      "run scripts/check-test-residue.mjs before trusting this project's prod data. " +
      "See docs/AI_Interior_Atelier_PRD_v3.md §3 and PROJECT_BRAIN.md 'Known Gaps Against PRD v3'."
    );
    return { usingDedicatedTestProject: false };
  }

  throw new Error("Neither .env.test nor .env.local found — cannot load Supabase credentials.");
}

function applyEnvFile(filePath) {
  const contents = readFileSync(filePath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
