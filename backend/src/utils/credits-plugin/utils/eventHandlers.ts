import { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

interface StripeEventData extends Stripe.Event.Data {
  id: string;
  customer: string;
  plan: Stripe.Plan;
  cancel_at: number;
  cancel_at_period_end: number;
  canceled_at: number;
}

export async function createOrRetrieveUser(
  supabaseClient: SupabaseClient,
  customer: Stripe.Customer
) {
  if (!customer.id || !customer.email) {
    throw new Error('Missing required customerID and customerEmail.');
  }

  const { data } = await supabaseClient.auth.admin.createUser({
    user_metadata: {
      full_name: customer.name
    },
    email: customer.email
  });
  const { user } = data;

  const userProfile = (
    await supabaseClient
      .from('profiles')
      .select('*')
      .eq('email', user?.email ?? customer.email)
      .single()
  ).data;

  if (!userProfile) {
    throw new Error('Failed to retrieve user profile.');
  }

  return userProfile.customer_id === null
    ? (
        await supabaseClient
          .from('profiles')
          .update({ customer_id: customer.id })
          .eq('user_id', userProfile.user_id)
          .select()
          .single()
      ).data
    : userProfile;
}

export async function handleSubscriptionCreated(
  event: Stripe.Event,
  supabaseClient: SupabaseClient,
  stripeClient: Stripe
) {
  const subscription = event.data.object as StripeEventData;
  const customer = (await stripeClient.customers.retrieve(
    subscription.customer
  )) as Stripe.Customer;

  const tiers = subscription.plan.tiers?.[0];

  if (!tiers) {
    throw new Error(`No tiers found for subscription: ${subscription.id}`);
  }

  const user = await createOrRetrieveUser(supabaseClient, customer);

  if (!user) {
    throw new Error(
      `Could not find user with customer_id ${subscription.customer}`
    );
  }

  if (tiers.up_to) {
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        credits: user.credits + tiers.up_to,
        subscription_id: subscription.id
      })
      .eq('user_id', user.user_id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function handleSubscriptionUpdated(
  event: Stripe.Event,
  supabaseClient: SupabaseClient
) {
  const subscription = event.data.object as StripeEventData;
  const tiers = subscription.plan.tiers?.[0];

  if (!tiers) {
    throw new Error(`No tiers found for subscription: ${subscription.id}`);
  }

  const user = (
    await supabaseClient
      .from('profiles')
      .select('*')
      .eq('customer_id', subscription.customer)
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
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        credits: user.credits + tiers.up_to,
        subscription_id: subscription.id
      })
      .eq('user_id', user.user_id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function handleDeletedSubscribtion(
  event: Stripe.Event,
  supabaseClient: SupabaseClient
) {
  const subscription = event.data.object as StripeEventData;
  const user = (
    await supabaseClient
      .from('profiles')
      .select('*')
      .eq('subscription_id', subscription.id)
      .single()
  ).data;

  if (!user) {
    return;
  }

  const { error } = await supabaseClient
    .from('profiles')
    .update({ subscription_id: null })
    .eq('user_id', user.user_id);

  if (error) {
    throw new Error(error.message);
  }
}
