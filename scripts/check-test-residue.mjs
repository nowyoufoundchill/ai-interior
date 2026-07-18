import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * PRD v3 §12.2 residue rule: after every verification cycle, a read-only
 * query against PRODUCTION must confirm zero rows and zero Storage objects
 * carrying any test_run_id. This intentionally always reads .env.local
 * (production), never .env.test — the whole point is checking the
 * environment tests are NOT supposed to touch. A nonzero result is a
 * failing gate, not a cleanup chore.
 */
const TABLES = [
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

loadEnvFile(path.join(process.cwd(), ".env.local"));

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  let totalResidue = 0;

  for (const table of TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .not("test_run_id", "is", null);

    if (error) {
      console.error(`[residue] ${table}: ERROR ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    if (count && count > 0) {
      totalResidue += count;
      console.error(`[residue] ${table}: ${count} row(s) with a non-null test_run_id`);
    } else {
      console.log(`[residue] ${table}: clean`);
    }
  }

  const { data: files, error: storageError } = await supabase.storage.from("room-photos").list("test-runs");
  if (storageError && !storageError.message.includes("not found")) {
    console.error(`[residue] storage: ERROR ${storageError.message}`);
    process.exitCode = 1;
  } else if (files?.length) {
    totalResidue += files.length;
    console.error(`[residue] storage: ${files.length} leftover object(s)/folder(s) under test-runs/`);
  } else {
    console.log(`[residue] storage: clean`);
  }

  if (totalResidue > 0) {
    console.error(`[residue] FAILING GATE: ${totalResidue} total residue item(s) found in production.`);
    process.exitCode = 1;
  } else {
    console.log(`[residue] PASS: zero test residue in production.`);
  }
}

function loadEnvFile(filePath) {
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

main().catch((error) => {
  console.error("[residue] FAILED:", error.message);
  process.exitCode = 1;
});
