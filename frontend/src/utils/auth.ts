import { sse } from './sse';
import Cookies from 'js-cookie';

export function clearAllData() {
  // Clear all cookies
  const allCookies = Cookies.get();
  for (const cookie in allCookies) {
    Cookies.remove(cookie);
  }

  // Clear localStorage
  localStorage.clear();
}

export function logout() {
  sse.closeConnection();
  useResetStore().all();
  clearAllData();
  useRouter().push('/auth/login');
}

