import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const tables = [
  "users",
  "homes",
  "rooms",
  "photos",
  "room_analyses",
  "mood_boards",
  "products",
  "renders",
  "revisions",
  "design_memories",
  "design_preferences",
  "chat_messages",
  "ai_runs"
];

let failed = false;

for (const name of requiredEnv) {
  const present = Boolean(process.env[name]);
  console.log(`${name}: ${present ? "set" : "missing"}`);
  failed ||= !present;
}

console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "set" : "missing"}`);

if (failed) {
  process.exitCode = 1;
  process.exit();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

for (const table of tables) {
  const { error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    failed = true;
    console.log(`${table}: ERROR ${error.message}`);
  } else {
    console.log(`${table}: OK`);
  }
}

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) {
  failed = true;
  console.log(`storage: ERROR ${bucketError.message}`);
} else {
  const roomPhotos = buckets.find((bucket) => bucket.name === "room-photos");
  if (!roomPhotos) {
    failed = true;
    console.log("room-photos bucket: missing");
  } else {
    console.log(`room-photos bucket: ${roomPhotos.public ? "public" : "private"}`);
  }
}

process.exitCode = failed ? 1 : 0;
