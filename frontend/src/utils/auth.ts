import type { Provider } from '@supabase/supabase-js';
import Cookies from 'js-cookie';
import { sse } from './sse';

export async function signInWithOAuth(provider: Provider) {
  const $supabase = useSupabaseClient();
  const { error } = await $supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/callback`,
      skipBrowserRedirect: false,
      scopes:
        provider === 'azure'
          ? 'email https://outlook.office.com/IMAP.AccessAsUser.All'
          : 'https://mail.google.com/',

      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  if (error) {
    throw error;
  }
}

export function clearPersistedData() {
  const allCookies = Cookies.get();
  Object.keys(allCookies).forEach((cookie) => Cookies.remove(cookie));
  localStorage.clear();
}

export function signOutManually() {
  sse.closeConnection();
  clearPersistedData();
  useResetStore().all();
  useSupabaseUser().value = null; // updates $user in AppHeader
  useSupabaseUserProfile().value = null;
  useRouter().push('/auth/login');
}

export async function signOut() {
  const { error } = await useSupabaseClient().auth.signOut();
  useSupabaseUser().value = null;
  useSupabaseUserProfile().value = null;
  if (error) {
    reloadNuxtApp({ persistState: false });
  }
}
