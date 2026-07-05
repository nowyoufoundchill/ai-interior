import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createServerSupabaseClient() {
  const env = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!env || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  return createClient<Database>(env.url, serviceRoleKey);
}

export function createServiceSupabaseClient() {
  const env = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!env || !serviceRoleKey) {
    throw new Error("Supabase service environment variables are not configured.");
  }

  return createClient<Database>(env.url, serviceRoleKey);
}
