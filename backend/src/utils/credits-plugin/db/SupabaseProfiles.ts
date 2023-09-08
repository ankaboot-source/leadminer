import { SupabaseClient } from '@supabase/supabase-js';
import { Profile, Profiles } from './interfaces';

export default class SupabaseProfiles implements Profiles {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  async createNewUserProfile(
    customerEmail: string,
    customerName: string | null | undefined
  ): Promise<Profile> {
    const user = await this.createUserInSupabase(customerEmail, customerName);
    const profile = user?.email
      ? await this.getUserProfileByEmail(user.email)
      : null;

    if (profile === null) {
      throw new Error('Failed to retrieve or create user.');
    }

    return profile;
  }

  async getUserProfileByEmail(email: string): Promise<Profile | null> {
    const { data: user, error } = await this.supabaseClient
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return user ?? null;
  }

  async getUserProfileBySubscriptionId(
    subscriptionId: string
  ): Promise<Profile | null> {
    const { data: user, error } = await this.supabaseClient
      .from('profiles')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId);

    if (error) {
      throw new Error(error.message);
    }

    return user[0] ?? null;
  }

  async updateUserProfile(
    userId: string,
    data: Partial<Profile>
  ): Promise<Profile | null> {
    const { data: user, error } = await this.supabaseClient
      .from('profiles')
      .update({ ...data })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return user;
  }

  private async createUserInSupabase(
    email: string,
    customerName: string | null | undefined
  ) {
    const { data } = await this.supabaseClient.auth.admin.createUser({
      user_metadata: {
        full_name: customerName
      },
      email
    });

    return data.user;
  }
}
