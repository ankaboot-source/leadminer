import { createClient } from "https://esm.sh/v135/@supabase/supabase-js@2.43.2/dist/module/index.js";

const createSupabaseClient = (
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorization: string,
) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
};

export default createSupabaseClient;
