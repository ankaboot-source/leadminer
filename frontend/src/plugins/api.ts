export default defineNuxtPlugin({
  setup() {
    const supabase = useSupabaseClient();
    const config = useRuntimeConfig();

    const api = $fetch.create({
      baseURL: `${config.public.SERVER_ENDPOINT}/api`,
      async onRequest({ options }) {
        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        if (token) {
          options.headers = { 'x-sb-jwt': token };
        }
      },
    });

    const saasEdgeFunctions = $fetch.create({
      baseURL: `${config.public.SAAS_SUPABASE_PROJECT_URL}/functions/v1/`,
      async onRequest({ options }) {
        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        options.headers = {
          Authorization: `Bearer ${token || config.public.SAAS_SUPABASE_ANON_KEY}`,
        };
      },
    });
    return {
      provide: {
        api,
        saasEdgeFunctions,
      },
    };
  },
});
