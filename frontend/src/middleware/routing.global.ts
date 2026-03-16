export default defineNuxtRouteMiddleware(async (to) => {
  const $supabase = useSupabaseClient();
  const { session } = (await $supabase.auth.getSession()).data;

  const homePath = '/';
  const minePath = '/mine';
  const contactsPath = '/contacts';
  const protectedPaths = [
    '/mine',
    '/contacts',
    '/sources',
    '/campaigns',
    '/account',
  ];

  if (to.path === homePath) {
    if (!session) {
      if ('error' in to.query) {
        // #1980
        return navigateTo({
          name: 'auth-login',
          query: { error: to.query.error },
        });
      }

      return navigateTo({ name: 'auth-login' });
    }

    const userId =
      session.user.id || (session.user as { sub?: string } | null)?.sub;

    if (!userId) {
      return navigateTo(minePath);
    }

    const $contactsStore = useContactsStore();
    let hasContacts = false;
    try {
      hasContacts = await $contactsStore.hasPersons(userId);
    } catch {
      return navigateTo(minePath);
    }

    return navigateTo(hasContacts ? contactsPath : minePath);
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

  if (!session && protectedPaths.some((path) => to.path.startsWith(path))) {
    return navigateTo({ name: 'auth-login' });
  }

  return true;
});
