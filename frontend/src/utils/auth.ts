import { sse } from './sse';

export async function logout() {
  sse.closeConnection();
  useLeadminerStore().$reset();
  navigateTo('/auth/login');
}
