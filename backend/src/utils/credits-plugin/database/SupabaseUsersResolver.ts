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
      await this.supabaseClient.auth.admin.inviteUserByEmail(userEmail, {
        data: {
          Invite: {
            Prehead: 'Invitation to leadminer',
            Title: "You're Invited to Join",
            Body1: "You're invited to join ",
            Body2:
              "! We're excited to have you as part of our community. With our platform, you can effortlessly generate clean and enriched contacts directly from your mailbox. To get started, click the button below to accept the invitation and create your account.",
            Button: 'Accept Invitation',
            Regards: 'Best regards,',
            Footer:
              "You received this email because we received a request for your account. If you didn't request it, you can safely delete this email."
          }
        }
      });

    if (inviteUserError) {
      return inviteUserError;
    }
    return true;
  }

  async generateMagicLink(
    userEmail: string,
    redirectTo: string
  ): Promise<string> {
    const { data, error } = await this.supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: { redirectTo }
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
