export default defineNuxtRouteMiddleware(async (to) => {
  const $supabase = useSupabaseClient();
  const { session } = (await $supabase.auth.getSession()).data;

  const homePath = '/';

  if (to.path === homePath)
    if (!session) {
      if ('error' in to.query) {
        // #1980
        return navigateTo({
          name: 'auth-login',
          query: { error: to.query.error },
        });
      }

      return navigateTo({ name: 'auth-login' });
    } else {
      const $contactsStore = useContactsStore();
      await $contactsStore.reloadContacts();
      const path = $contactsStore.contactCount ? '/contacts' : '/mine';
      return navigateTo(path);
    }

  if (session && to.path.startsWith('/auth')) {
    return navigateTo(homePath);
  }

  if (to.path.startsWith('/oauth-consent-error')) {
    return navigateTo({
      path: homePath,
      query: {
        error: 'oauth-consent',
        ...to.query,
      },
    });
  }

  return true;
});
