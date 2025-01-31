export default defineNuxtRouteMiddleware(async (to) => {
  const $supabase = useSupabaseClient();
  const { session } = (await $supabase.auth.getSession()).data;
  const $contactsStore = useContactsStore();
  if (session) await $contactsStore.loadContacts();
  const homePath = $contactsStore.contactCount ? '/contacts' : '/mine';

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
