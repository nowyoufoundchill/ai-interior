import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

/**
 * P0.0 test-environment contract (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md,
 * amended by owner decision 2026-07-10 — see test-isolation.config.json).
 *
 * Two supported modes, resolved in this order:
 *
 * 1. ISOLATED — `.env.test` exists and points at a DIFFERENT Supabase
 *    project than `.env.local`. Always preferred when available.
 * 2. PRODUCTION (owner-acknowledged) — no `.env.test`, but the committed
 *    `test-isolation.config.json` carries the owner's explicit decision to
 *    run automated suites against the production project. In this mode the
 *    old safety regime is mandatory: every row/object tagged with
 *    test_run_id, teardown after every cycle, residue check as a failing
 *    gate.
 *
 * Anything else FAILS CLOSED. There is no silent fallback: the production
 * mode exists only because the owner recorded that decision in a committed
 * config file, and it announces itself loudly on every run.
 *
 * Project identity is compared/reported as a SHA-256 fingerprint of the
 * Supabase project ref so nothing sensitive is printed.
 */

export function parseEnvFile(filePath) {
  const contents = readFileSync(filePath, "utf-8");
  const vars = {};
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
    vars[key] = value;
  }
  return vars;
}

export function projectRefFromSupabaseUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

/** Non-reversible, non-secret identifier for a Supabase project ref. */
export function projectFingerprint(refOrUrl) {
  const ref = refOrUrl?.startsWith("http") ? projectRefFromSupabaseUrl(refOrUrl) : refOrUrl;
  if (!ref) return null;
  return createHash("sha256").update(ref).digest("hex").slice(0, 12);
}

export class TestIsolationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TestIsolationError";
  }
}

const PROVISIONING_HINT =
  "Either provision a dedicated test Supabase project (docs/OPERATIONS.md#optional-isolated-test-project) or record the " +
  "owner's explicit run-against-production decision in test-isolation.config.json ({\"mode\": \"production\", ...}).";

export function readIsolationConfig() {
  const configPath = path.join(process.cwd(), "test-isolation.config.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Loader for mutation-capable scripts/suites. Applies the resolved env file
 * to process.env (existing process env always wins, so per-run overrides
 * like AI_MODE=live still work) and throws TestIsolationError when neither
 * supported mode applies.
 *
 * Returns { mode, activeFingerprint, productionFingerprint } — fingerprints
 * only, never credentials. (`usingDedicatedTestProject` kept for older
 * callers.)
 */
export function loadTestEnv() {
  const testEnvPath = path.join(process.cwd(), ".env.test");
  const localEnvPath = path.join(process.cwd(), ".env.local");
  const productionFingerprint = existsSync(localEnvPath)
    ? projectFingerprint(parseEnvFile(localEnvPath).NEXT_PUBLIC_SUPABASE_URL)
    : null;

  // Mode 1 — isolated test project (always preferred when present).
  if (existsSync(testEnvPath)) {
    const testVars = parseEnvFile(testEnvPath);
    const testRef = projectRefFromSupabaseUrl(testVars.NEXT_PUBLIC_SUPABASE_URL);
    if (!testRef || !testVars.SUPABASE_SERVICE_ROLE_KEY) {
      throw new TestIsolationError(
        "FAIL CLOSED: .env.test exists but is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
          PROVISIONING_HINT
      );
    }
    const testFingerprint = projectFingerprint(testRef);
    if (productionFingerprint && testFingerprint === productionFingerprint) {
      throw new TestIsolationError(
        `FAIL CLOSED: .env.test resolves to the SAME Supabase project as .env.local ` +
          `(fingerprint ${testFingerprint}). Point .env.test at a dedicated test project, or delete it ` +
          `to use the owner-acknowledged production mode.`
      );
    }
    applyVars(testVars);
    console.log(
      `[test-env] Mode: ISOLATED — test project ${testFingerprint} != production ${productionFingerprint ?? "(no .env.local)"}.`
    );
    return {
      mode: "isolated",
      usingDedicatedTestProject: true,
      activeFingerprint: testFingerprint,
      testFingerprint,
      productionFingerprint
    };
  }

  // Mode 2 — owner-acknowledged production testing.
  const config = readIsolationConfig();
  if (config?.mode === "production") {
    if (!existsSync(localEnvPath)) {
      throw new TestIsolationError("Production test mode is configured but .env.local was not found.");
    }
    applyVars(parseEnvFile(localEnvPath));
    console.warn(
      `[test-env] Mode: PRODUCTION (owner-acknowledged ${config.date ?? "undated"}) — suites run against the ` +
        `production project ${productionFingerprint}. Every row/object MUST carry test_run_id; teardown + ` +
        `check:residue are failing gates, not cleanup chores.`
    );
    return {
      mode: "production",
      usingDedicatedTestProject: false,
      activeFingerprint: productionFingerprint,
      testFingerprint: null,
      productionFingerprint
    };
  }

  throw new TestIsolationError(
    "FAIL CLOSED: no .env.test and no owner-acknowledged production mode. Mutation-capable test " +
      "scripts refuse to run. " + PROVISIONING_HINT
  );
}

function applyVars(vars) {
  for (const [key, value] of Object.entries(vars)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Read-only variant: reports the current mode/fingerprints without applying
 * anything to process.env and without throwing. Used to REPORT state (suite
 * preflight diagnostics), never to authorize mutation.
 */
export function describeTestEnv() {
  const testEnvPath = path.join(process.cwd(), ".env.test");
  const localEnvPath = path.join(process.cwd(), ".env.local");
  const test = existsSync(testEnvPath)
    ? projectFingerprint(parseEnvFile(testEnvPath).NEXT_PUBLIC_SUPABASE_URL)
    : null;
  const production = existsSync(localEnvPath)
    ? projectFingerprint(parseEnvFile(localEnvPath).NEXT_PUBLIC_SUPABASE_URL)
    : null;
  const isolated = Boolean(test && (!production || test !== production));
  const config = readIsolationConfig();
  const mode = isolated ? "isolated" : config?.mode === "production" ? "production" : "blocked";
  return {
    mode,
    testEnvExists: existsSync(testEnvPath),
    testFingerprint: test,
    productionFingerprint: production,
    activeFingerprint: mode === "isolated" ? test : mode === "production" ? production : null,
    isolated
  };
}
