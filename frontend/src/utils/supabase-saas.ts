import { createClient } from '@supabase/supabase-js';

function createSupabaseClient() {
  return createClient(
    useRuntimeConfig().public.SAAS_SUPABASE_PROJECT_URL,
    useRuntimeConfig().public.SAAS_SUPABASE_SECRET_PROJECT_TOKEN
  );
}

export const $supabaseSaaS = createSupabaseClient();
