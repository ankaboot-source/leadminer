import { createClient } from "supabase";
import ENV from "./config.ts";

export function createSupabaseAdmin() {
  return createClient(
    ENV.SUPABASE_URL,
    ENV.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createSupabaseClient(authorization = "") {
  return createClient(
    ENV.SUPABASE_URL,
    ENV.SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: authorization },
      },
    }
  );
}