import { sse } from './sse';

export function logout() {
  sse.closeConnection();
  useLeadminerStore().$reset();
  navigateTo('/auth/login');
}
