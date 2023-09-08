import { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { StripeEvent, StripeEventHandler } from './types';

/**
 * Handles the creation of a Stripe subscription.
 */
export default class StripeSubscriptionCreated implements StripeEventHandler {
  constructor(
    private readonly event: StripeEvent,
    private readonly supabaseClient: SupabaseClient,
    private readonly stripeClient: Stripe
  ) {}

  async handle(): Promise<void> {
    const subscription = this.event.data.object;
    const customer = (await this.stripeClient.customers.retrieve(
      subscription.customer
    )) as Stripe.Customer;

    const tiers = subscription.plan.tiers?.[0];

    if (!tiers) {
      throw new Error(`No tiers found for subscription: ${subscription.id}`);
    }

    const user = await this.createOrRetrieveUser(customer);

    if (!user) {
      throw new Error(
        `Could not find user with stripe_customer_id ${subscription.customer}`
      );
    }

    if (tiers.up_to) {
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

  private async createOrRetrieveUser(customer: Stripe.Customer) {
    if (!customer.id || !customer.email) {
      throw new Error('Missing required customerID and customerEmail.');
    }

    const { data } = await this.supabaseClient.auth.admin.createUser({
      user_metadata: {
        full_name: customer.name
      },
      email: customer.email
    });
    const { user } = data;

    const userProfile = (
      await this.supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', user?.email ?? customer.email)
        .single()
    ).data;

    if (!userProfile) {
      throw new Error('Failed to retrieve user profile.');
    }

    return userProfile.stripe_customer_id === null
      ? (
          await this.supabaseClient
            .from('profiles')
            .update({ stripe_customer_id: customer.id })
            .eq('user_id', userProfile.user_id)
            .select()
            .single()
        ).data
      : userProfile;
  }
}
