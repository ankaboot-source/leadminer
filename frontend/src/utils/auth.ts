import Cookies from 'js-cookie';
import { sse } from './sse';

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
  /// @ts-expect-error supabase type bug (https://github.com/nuxt-modules/supabase/issues/406)
  useSupabaseUser().value = null; // updates $user in AppHeader
}

export async function signOut() {
  await useSupabaseClient().auth.signOut();
}
