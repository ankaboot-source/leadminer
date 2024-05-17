import Cookies from 'js-cookie';
import { sse } from './sse';

export function clearAllData() {
  const allCookies = Cookies.get();
  Object.keys(allCookies).forEach((cookie) => Cookies.remove(cookie));
  localStorage.clear();
}

export function logout() {
  sse.closeConnection();
  useResetStore().all();
  clearAllData();
  useRouter().push('/auth/login');
}
