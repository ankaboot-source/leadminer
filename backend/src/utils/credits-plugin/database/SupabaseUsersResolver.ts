import { SupabaseClient } from '@supabase/supabase-js';
import { Profile, Users } from './interfaces/Users';

export default class SupabaseUsers implements Users {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  async create(profile: Partial<Profile>): Promise<Profile> {
    const { email } = profile;

    if (!email) {
      throw new Error('User email is missing.');
    }

    const { data: user, error } =
      await this.supabaseClient.auth.admin.createUser({ email });

    if (error) {
      throw new Error(error.message);
    }

    const userProfile = await this.update(user.user.id, { ...profile });

    if (userProfile === null) {
      throw new Error('Failed to update user profile.');
    }

    return userProfile;
  }

  async update(
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

  async getByEmail(email: string): Promise<Profile | null> {
    const { data: user, error } = await this.supabaseClient
      .from('profiles')
      .select('*')
      .eq('email', email);

    if (error) {
      throw new Error(error.message);
    }
    return user[0] ?? null;
  }

  async getBySubscriptionId(subscriptionId: string): Promise<Profile | null> {
    const { data: user, error } = await this.supabaseClient
      .from('profiles')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId);

    if (error) {
      throw new Error(error.message);
    }

    return user[0] ?? null;
  }

  async inviteUserByEmail(userEmail: string): Promise<true | Error> {
    const { error: inviteUserError } =
      await this.supabaseClient.auth.admin.inviteUserByEmail(userEmail);

    if (inviteUserError) {
      return inviteUserError;
    }
    return true;
  }

  async generateMagicLink(userEmail: string): Promise<string> {
    const { data, error } = await this.supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.properties.action_link) {
      throw new Error('Unable to generate action link.');
    }

    return data.properties.action_link;
  }
}
