import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnv, parseEnvFile, projectFingerprint } from "./test-env.mjs";

// Fail closed (P0.0) like every other mutation-capable script. One explicit,
// never-silent exception: TEARDOWN_ALLOW_PRODUCTION=1 lets the OWNER remove
// legacy tagged residue from production (rows created back when the harness
// fell back to .env.local). It only ever deletes rows carrying the given
// test_run_id, and it announces the target loudly.
if (process.env.TEARDOWN_ALLOW_PRODUCTION === "1") {
  const localVars = parseEnvFile(path.join(process.cwd(), ".env.local"));
  for (const [key, value] of Object.entries(localVars)) {
    if (!(key in process.env)) process.env[key] = value;
  }
  console.warn(
    `[teardown-test] TEARDOWN_ALLOW_PRODUCTION=1 — targeting PRODUCTION project ` +
      `${projectFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL)} to remove tagged residue only.`
  );
} else {
  loadTestEnv();
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Deleted explicitly, child-to-parent, rather than relying on cascade —
// `revisions`/`ai_runs` use `on delete set null` for room_id, not cascade,
// so they would otherwise survive a `homes` delete with a dangling
// test_run_id. Explicit per-table deletes make "removes everything carrying
// this id" true regardless of each table's FK behavior (PRD v3 §3).
const TABLES_CHILD_TO_PARENT = [
  "action_proposals",
  "generation_jobs",
  "implementation_packages",
  "ai_runs",
  "revisions",
  "design_memories",
  "chat_messages",
  "design_preferences",
  "renders",
  "products",
  "mood_boards",
  "room_analyses",
  "photos",
  "rooms",
  "homes"
];

async function main() {
  const testRunId = process.argv[2] ?? readCurrentTestRunId();
  if (!testRunId) {
    throw new Error("No test_run_id provided and no test-runs/current.json found. Usage: node scripts/teardown-test.mjs <test_run_id>");
  }

  console.log(`[teardown-test] tearing down test_run_id = ${testRunId}`);

  await removeStorageObjects(testRunId);

  for (const table of TABLES_CHILD_TO_PARENT) {
    const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("test_run_id", testRunId);
    if (error) {
      // An additive table whose migration hasn't been applied yet has nothing to
      // clean — tolerate it (matches the app's graceful "table missing" fallback)
      // so teardown stays a valid gate while new code lands ahead of its migration.
      if (/could not find the table|schema cache|does not exist/i.test(error.message)) {
        console.log(`[teardown-test] ${table}: skipped (table not present yet)`);
        continue;
      }
      console.error(`[teardown-test] ${table}: ERROR ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`[teardown-test] ${table}: removed ${count ?? 0}`);
  }

  const statePath = path.join(process.cwd(), "test-runs", "current.json");
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    if (state.testRunId === testRunId) {
      rmSync(statePath);
    }
  }

  console.log(`[teardown-test] done.`);
}

function readCurrentTestRunId() {
  const statePath = path.join(process.cwd(), "test-runs", "current.json");
  if (!existsSync(statePath)) return null;
  return JSON.parse(readFileSync(statePath, "utf-8")).testRunId ?? null;
}

async function removeStorageObjects(testRunId) {
  const prefix = `test-runs/${testRunId}`;
  const { data: files, error } = await supabase.storage.from("room-photos").list(prefix);
  if (error) {
    console.log(`[teardown-test] storage list (${prefix}): ${error.message} (likely already empty)`);
    return;
  }
  if (!files?.length) {
    console.log(`[teardown-test] storage (${prefix}): nothing to remove`);
    return;
  }
  const paths = files.map((file) => `${prefix}/${file.name}`);
  const { error: removeError } = await supabase.storage.from("room-photos").remove(paths);
  if (removeError) {
    console.error(`[teardown-test] storage remove ERROR: ${removeError.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[teardown-test] storage: removed ${paths.length} object(s) under ${prefix}`);
}

main().catch((error) => {
  console.error("[teardown-test] FAILED:", error.message);
  process.exitCode = 1;
});
