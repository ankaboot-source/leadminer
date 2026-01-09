import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';

type EngagementType = 'CSV' | 'ENRICH';

export default class Engagements {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  async register(
    enriched: {
      email: string;
      user_id: string;
      engagement_type: EngagementType;
      service: string;
    }[]
  ) {
    try {
      const { error } = await this.client
        .schema('private')
        .from('engagement')
        .upsert(enriched);
      if (error) throw error;
    } catch (err) {
      const message = (err as Error).message || 'Unexpected error.';
      this.logger.error(`[${this.constructor.name}.register]: ${message}`);
      throw err;
    }
  }
}
