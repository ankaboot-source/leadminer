import { StripeEvent, StripeEventHandler } from './types';
import SupabaseProfiles from '../../db/SupabaseProfiles';

/**
 * Handles the deletion of a Stripe subscription.
 */
export default class StripeSubscriptionDeleted implements StripeEventHandler {
  constructor(
    private readonly event: StripeEvent,
    private readonly supabaseClient: SupabaseProfiles
  ) {}

  async handle(): Promise<void> {
    const subscription = this.event.data.object;
    const user = await this.supabaseClient.getUserProfileBySubscriptionId(
      subscription.id
    );

    if (!user) {
      return;
    }

    await this.supabaseClient.updateUserProfile(user.user_id, {
      stripe_subscription_id: null
    });
  }
}
