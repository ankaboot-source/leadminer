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

  async getExportedContacts(
    userId: string,
    ids?: string[],
  ): Promise<Contact[]> {
    let query = this.supabase
      .schema("private")
      .from("engagement")
      .select("person_id")
      .eq("user_id", userId)
      .eq("engagement_type", "EXPORT");

    if (ids && ids.length > 0) {
      query = query.in("person_id", ids);
    }

    const { data: engagementData, error: engagementError } = await query;
    if (engagementError) {
      throw new Error(
        `Failed to fetch exported contacts: ${engagementError.message}`,
      );
    }

    const exportedIds = (engagementData || []).map((e) => e.person_id);
    if (exportedIds.length === 0) return [];

    return this.getContacts(userId, exportedIds);
  }

  async getNonExportedContacts(
    userId: string,
    ids?: string[],
  ): Promise<Contact[]> {
    const allContacts = await this.getContacts(userId, ids);

    const { data: engagementData, error: engagementError } = await this
      .supabase
      .schema("private")
      .from("engagement")
      .select("person_id")
      .eq("user_id", userId)
      .eq("engagement_type", "EXPORT");

    if (engagementError) {
      throw new Error(
        `Failed to fetch engagement: ${engagementError.message}`,
      );
    }

    const exportedIds = new Set(
      (engagementData || []).map((e) => e.person_id),
    );

    return allContacts.filter((c) => !exportedIds.has(c.id));
  }

  async registerExportedContacts(
    personIds: string[],
    service: string,
    userId: string,
  ): Promise<void> {
    const values = personIds.map((personId) => ({
      user_id: userId,
      person_id: personId,
      engagement_type: "EXPORT",
      service,
    }));

    const { error } = await this.supabase
      .schema("private")
      .from("engagement")
      .upsert(values);

    if (error) {
      throw new Error(
        `Failed to register exported contacts: ${error.message}`,
      );
    }
  }
}
