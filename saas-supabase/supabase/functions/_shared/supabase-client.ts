import { createClient } from "supabase";

function createSupabaseClient(authorization = "") {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: authorization },
      },
    }
  );
}
export default createSupabaseClient;
