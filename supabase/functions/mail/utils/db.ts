import { createSupabaseAdmin } from "../../_shared/supabase.ts";
const supabase = createSupabaseAdmin();

export async function getMiningStats(userId: string, miningId: string) {
  const { data, error } = await supabase
    .schema("private")
    .rpc("get_contacts_table", { user_id: userId, mining_id: miningId });

  if (error) throw error;
  return data;
}

export async function getUserEmail(userId: string): Promise<string> {
  const { data: { user }, error } = await supabase.from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user.email) {
    console.error("Error getting user email:", error.message);
    throw error;
  }

  return user.email;
}
