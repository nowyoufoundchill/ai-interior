"use client";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient<Database>(env.url, env.anonKey);
}
