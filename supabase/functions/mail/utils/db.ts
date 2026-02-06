import { createSupabaseAdmin } from "../../_shared/supabase.ts";
const supabase = createSupabaseAdmin();

type MiningStats = {
  user_id: string;
  source: string;
  total_contacts_mined: number;
  total_reachable: number;
  total_with_phone: number;
  total_with_company: number;
  total_with_location: number;
};

export async function getMiningStats(miningId: string): Promise<MiningStats> {
  const { data, error } = await supabase
    .schema("private")
    .rpc("get_mining_stats", { mining_id: miningId })
    .maybeSingle();

  if (error) throw error;
  return data as MiningStats;
}

export async function getUserEmail(userId: string): Promise<string> {
  const { data, error } = await supabase.schema("private")
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.email) {
    console.error("Error getting user email:", error?.message);
    throw error;
  }

  return data.email;
}

export async function getUserLanguage(userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw error;

  const language = data?.user?.user_metadata?.EmailTemplate?.language || "en";

  return language;
}
