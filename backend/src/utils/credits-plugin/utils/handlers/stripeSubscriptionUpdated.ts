import { SupabaseClient } from '@supabase/supabase-js';
import { StripeEvent, StripeEventHandler } from './types';

/**
 * Handles Stripe subscription updates.
 */
export default class StripeSubscriptionUpdated implements StripeEventHandler {
  constructor(
    private readonly event: StripeEvent,
    private readonly supabaseClient: SupabaseClient
  ) {}

  async handle(): Promise<void> {
    const subscription = this.event.data.object;
    const tiers = subscription.plan.tiers?.[0];

    if (!tiers) {
      throw new Error(`No tiers found for subscription: ${subscription.id}`);
    }

    const user = (
      await this.supabaseClient
        .from('profiles')
        .select('*')
        .eq('stripe_customer_id', subscription.customer)
        .single()
    ).data;

    if (!user) {
      return;
    }

    const isCancelingSubscription =
      subscription.cancel_at &&
      subscription.cancel_at_period_end &&
      subscription.canceled_at;

    if (!isCancelingSubscription && tiers.up_to) {
      const { error } = await this.supabaseClient
        .from('profiles')
        .update({
          credits: user.credits + tiers.up_to,
          stripe_subscription_id: subscription.id
        })
        .eq('user_id', user.user_id);

      if (error) {
        throw new Error(error.message);
      }
    }
  }
}
