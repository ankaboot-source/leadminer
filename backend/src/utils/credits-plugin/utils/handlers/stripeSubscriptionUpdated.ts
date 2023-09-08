import { StripeEvent, StripeEventHandler } from './types';
import SupabaseProfiles from '../../db/SupabaseProfiles';

/**
 * Handles Stripe subscription updates.
 */
export default class StripeSubscriptionUpdated implements StripeEventHandler {
  constructor(
    private readonly event: StripeEvent,
    private readonly supabaseClient: SupabaseProfiles
  ) {}

  async handle(): Promise<void> {
    const subscription = this.event.data.object;
    const tiers = subscription.plan.tiers?.[0];

    if (!tiers) {
      throw new Error(`No tiers found for subscription: ${subscription.id}`);
    }

    const user = await this.supabaseClient.getUserProfileBySubscriptionId(
      subscription.id
    );

    if (!user) {
      return;
    }

    const isCancelingSubscription =
      subscription.cancel_at &&
      subscription.cancel_at_period_end &&
      subscription.canceled_at;

    if (!isCancelingSubscription && tiers.up_to) {
      await this.supabaseClient.updateUserProfile(user.user_id, {
        credits: user.credits + tiers.up_to,
        stripe_subscription_id: subscription.id
      });
    }
  }
}
