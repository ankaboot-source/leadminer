export default defineNuxtPlugin({
  setup() {
    const publicConfig = useRuntimeConfig().public;
    const api = $fetch.create({
      baseURL: `${publicConfig.SERVER_ENDPOINT}/api`,
      async onRequest({ options }) {
        const token = (await useSupabaseClient().auth.getSession()).data.session
          ?.access_token;
        if (token) {
          options.headers = { 'x-sb-jwt': token };
        }
      },
    });

    const saasEdgeFunctions = $fetch.create({
      baseURL: `${publicConfig.SAAS_SUPABASE_PROJECT_URL}/functions/v1`,
      async onRequest({ options }) {
        const token = (await useSupabaseClient().auth.getSession()).data.session
          ?.access_token;
        if (token) {
          options.headers = { Authorization: `Bearer ${token}` };
        }
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
