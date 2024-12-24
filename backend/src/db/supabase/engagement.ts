import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';

type EngagementType = 'CSV' | 'ENRICH';

export default class Engagement {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}
  async register(userId: string, emails: string[], type: EngagementType) {
    try {
      const data = emails.map((email) => ({
        email,
        user_id: userId,
        engagement_type: type
      }));
      const { error } = await this.client
        .schema('private')
        .from('engagement')
        .upsert(data);
      if (error) throw error;
    } catch (err) {
      const message = (err as Error).message || 'Unexpected error.';
      this.logger.error(`[${this.constructor.name}.register]: ${message}`);
      throw err;
    }
  }
}
