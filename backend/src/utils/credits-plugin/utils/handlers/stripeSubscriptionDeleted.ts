import { SupabaseClient } from '@supabase/supabase-js';
import { StripeEvent, StripeEventHandler } from './types';

/**
 * Handles the deletion of a Stripe subscription.
 */
export default class StripeSubscriptionDeleted implements StripeEventHandler {
  constructor(
    private readonly event: StripeEvent,
    private readonly supabaseClient: SupabaseClient
  ) {}

  async handle(): Promise<void> {
    const subscription = this.event.data.object;
    const user = (
      await this.supabaseClient
        .from('profiles')
        .select('*')
        .eq('stripe_subscription_id', subscription.id)
        .single()
    ).data;

    if (!user) {
      return;
    }

    const { error } = await this.supabaseClient
      .from('profiles')
      .update({ stripe_subscription_id: null })
      .eq('user_id', user.user_id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
