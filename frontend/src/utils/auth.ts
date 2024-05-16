import { sse } from './sse';

export function logout() {
  sse.closeConnection();
  useResetStore().all();
  navigateTo('/auth/login');
}
