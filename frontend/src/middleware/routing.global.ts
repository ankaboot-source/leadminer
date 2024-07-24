export default defineNuxtRouteMiddleware(async (to) => {
  const $supabase = useSupabaseClient();
  const { session } = (await $supabase.auth.getSession()).data;

  if (session && to.path.startsWith('/auth')) {
    return navigateTo('/dashboard');
  }

  if (to.path.startsWith('/oauth-consent-error')) {
    return navigateTo({
      path: '/dashboard',
      query: {
        error: 'oauth-consent',
        ...to.query,
      },
    });
  }

  return true;
});
