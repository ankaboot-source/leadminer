import { createClient } from '@supabase/supabase-js';

export const $supabaseSaaS = createClient(
  useRuntimeConfig().public.SAAS_SUPABASE_PROJECT_URL,
  useRuntimeConfig().public.SAAS_SUPABASE_SECRET_PROJECT_TOKEN
);
