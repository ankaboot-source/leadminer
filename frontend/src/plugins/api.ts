import { createClient } from '@supabase/supabase-js';

export default defineNuxtPlugin({
  setup() {
    const api = $fetch.create({
      baseURL: `${useRuntimeConfig().public.SERVER_ENDPOINT}/api`,
      async onRequest({ options }) {
        const token = (await useSupabaseClient().auth.getSession()).data.session
          ?.access_token;
        if (token) {
          options.headers = { 'x-sb-jwt': token };
        }
      },
    });

    const url = useRuntimeConfig().public.SAAS_SUPABASE_PROJECT_URL!;
    const key = useRuntimeConfig().public.SAAS_SUPABASE_ANON_KEY;
    const supabaseSaas = createClient(url, key);
    return {
      provide: {
        api,
        supabaseSaas,
      },
    };
  },
});
