import { sse } from "./sse";
import { supabase } from "./supabase";

export async function logout() {
  sse.closeConnection();
  await supabase.auth.signOut();
}
