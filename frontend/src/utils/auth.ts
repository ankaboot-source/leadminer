import { sse } from './sse';

export async function logout() {
  sse.closeConnection();
  await useSupabaseClient().auth.signOut();
}
