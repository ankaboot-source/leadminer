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
  useSupabaseUser(); // To refresh $user in AppHeader
}

export async function signOut() {
  await useSupabaseClient().auth.signOut();
}
