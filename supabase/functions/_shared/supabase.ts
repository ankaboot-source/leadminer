import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import { getRequiredEnv } from "./env-helpers.ts";

const SUPABASE_URL = getRequiredEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = getRequiredEnv("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

export function createSupabaseClient(
  authorization = "",
  supabaseUrl: string = SUPABASE_URL,
  supabaseAnonKey: string = SUPABASE_ANON_KEY,
) {
  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: { Authorization: authorization },
      },
    },
  );
}

export function createSupabaseAdmin(
  supabaseUrl: string = SUPABASE_URL,
  supabaseServiceRoleKey: string = SUPABASE_SERVICE_ROLE_KEY,
) {
  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
  );
}
