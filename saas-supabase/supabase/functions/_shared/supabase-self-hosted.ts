import { createClient } from "supabase";

export function createSupabaseAdmin() {
  return createClient(
    Deno.env.get("LEADMINER_PROJECT_URL")!,
    Deno.env.get("LEADMINER_SECRET_TOKEN")!
  );
}

export function createSupabaseClient(authorization = "") {
  return createClient(
    Deno.env.get("LEADMINER_PROJECT_URL")!,
    Deno.env.get("LEADMINER_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: authorization },
      },
    }
  );
}
