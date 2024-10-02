import { sse } from './sse';
import Cookies from 'js-cookie';
import type { Provider } from '@supabase/supabase-js';

export async function signInWithOAuth(provider: Provider) {
  const $supabase = useSupabaseClient();
  const { error } = await $supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/callback`,
      skipBrowserRedirect: false,
      scopes:
        provider === 'azure'
          ? 'https://outlook.office.com/IMAP.AccessAsUser.All'
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

export function clearAllData() {
  const allCookies = Cookies.get();
  Object.keys(allCookies).forEach((cookie) => Cookies.remove(cookie));
  localStorage.clear();
}

export function signOutManually() {
  sse.closeConnection();
  useResetStore().all();
  clearAllData();
  useRouter().push('/auth/login');
  useSupabaseUser().value = null; // updates $user in AppHeader
}

export async function signOut() {
  const { error } = await useSupabaseClient().auth.signOut();

  if (error) {
    throw error;
  }
}
