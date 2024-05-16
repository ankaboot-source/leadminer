import { createClient } from "supabase";

const createSupabaseAdmin = (supabaseUrl: string, supabaseKey: string) => {
  return createClient(
    supabaseUrl,
    supabaseKey,
  );
};

export default createSupabaseAdmin;
