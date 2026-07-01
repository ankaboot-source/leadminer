// EngagementsClient — Deno/Supabase port of backend/src/db/supabase/engagements.ts.
// Handles upserts into the `private.engagement` table to record
// per-person enrichment activity (CSV import, enrichment runs, etc.).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Logger } from "../../_shared/logger.ts";
import type { EngagementRecord } from "./db-types.ts";

/**
 * Writes engagement records (one per enriched person) to the
 * `private.engagement` table. Mirrors the backend's `Engagements.register`.
 */
export default class EngagementsClient {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Upsert an array of engagement rows. Existing rows are matched on
   * `(person_id, user_id, engagement_type, service)` via the table's
   * primary/unique key, so re-running enrichment for the same contact
   * is idempotent.
   *
   * @param enriched - One row per person receiving an enrichment event.
   */
  async register(enriched: EngagementRecord[]): Promise<void> {
    try {
      const { error } = await this.client
        .schema("private")
        .from("engagement")
        .upsert(enriched);
      if (error) throw error;
    } catch (err) {
      const message = (err as Error).message || "Unexpected error.";
      this.logger.error(`[${this.constructor.name}.register]: ${message}`);
      throw err;
    }
  }
}
