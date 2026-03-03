import ENV from '../config';

export interface MiningSourceWithCredentials {
  email: string;
  type: string;
  credentials: Record<string, unknown>;
}

export class MiningSourceService {
  private supabaseUrl: string;

  constructor() {
    this.supabaseUrl = ENV.SUPABASE_PROJECT_URL;
  }

  async getSourcesForUser(
    userId: string,
    email?: string
  ): Promise<{
    sources: MiningSourceWithCredentials[];
    refreshed: string[];
  }> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/fetch-mining-source`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': ENV.SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
          email: email || 'all',
          mode: 'service',
          user_id: userId
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch mining sources: ${error}`);
    }

    return response.json();
  }
}

export const miningSourceService = new MiningSourceService();
