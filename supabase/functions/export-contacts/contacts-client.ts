import { createSupabaseAdmin } from "../_shared/supabase.ts";
import type { Contact } from "./types.ts";

export class ContactsClient {
  constructor(
    private supabase: ReturnType<typeof createSupabaseAdmin>,
  ) {}

  async getContacts(userId: string, ids?: string[]): Promise<Contact[]> {
    if (ids && ids.length > 0) {
      const { data, error } = await this.supabase
        .schema("private")
        .rpc("get_contacts_table_by_ids", {
          p_user_id: userId,
          p_ids: ids,
        });
      if (error) {
        throw new Error(`Failed to fetch contacts: ${error.message}`);
      }
      return (data || []) as unknown as Contact[];
    }

    const { data, error } = await this.supabase
      .schema("private")
      .rpc("get_contacts_table", {
        p_user_id: userId,
      });
    if (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }
    return (data || []) as unknown as Contact[];
  }
}
