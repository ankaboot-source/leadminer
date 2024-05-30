import { createClient } from "supabase";

export function createSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL_SAAS")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY_SAAS")!
  );
}

export function createSupabaseClient(authorization = "") {
  return createClient(
    Deno.env.get("SUPABASE_URL_SAAS")!,
    Deno.env.get("SUPABASE_ANON_KEY_SAAS")!,
    {
      global: {
        headers: { Authorization: authorization },
      },
    }
  );
}
