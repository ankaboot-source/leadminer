export default defineNuxtPlugin({
  setup() {
    const runtimeConfig = useRuntimeConfig();
    const supabaseClient = useSupabaseClient();

    const api = $fetch.create({
      baseURL: `${runtimeConfig.public.SERVER_ENDPOINT}/api`,
      async onRequest({ options }) {
        const token = (await supabaseClient.auth.getSession()).data.session
          ?.access_token;
        if (token) {
          options.headers = { 'x-sb-jwt': token };
        }
      },
    });

    const saasEdgeFunctions = $fetch.create({
      baseURL: `${
        runtimeConfig.public.SAAS_SUPABASE_PROJECT_URL
      }/functions/v1/`,
      async onRequest({ options }) {
        const token = (await supabaseClient.auth.getSession()).data.session
          ?.access_token;
        options.headers = {
          Authorization: `Bearer ${token || runtimeConfig.public.SAAS_SUPABASE_ANON_KEY}`,
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
