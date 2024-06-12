import { createClient } from '@supabase/supabase-js';

export const $supabaseSaaS = () => {
  const config = useRuntimeConfig();
  return createClient(
    config.public.SAAS_SUPABASE_PROJECT_URL,
    config.public.SAAS_SUPABASE_ANON_KEY
  );
};
