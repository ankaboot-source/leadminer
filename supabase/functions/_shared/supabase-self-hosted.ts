import { createClient } from "supabase";
import ENV from "./config.ts";
import { Database } from "shared/database.ts";

export function createSupabaseAdmin() {
  return createClient<Database>(
    ENV.LEADMINER_PROJECT_URL,
    ENV.LEADMINER_SECRET_TOKEN,
  );
}

export function createSupabaseClient(authorization = "") {
  return createClient<Database>(
    ENV.LEADMINER_PROJECT_URL,
    ENV.LEADMINER_ANON_KEY,
    {
      global: {
        headers: { Authorization: authorization },
      },
    },
  );
}
