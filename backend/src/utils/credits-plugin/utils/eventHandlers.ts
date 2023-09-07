import { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export async function createOrRetrieveUser(
  supabaseClient: SupabaseClient,
  customer: Partial<Stripe.Customer>
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
  event: any,
  supabaseClient: SupabaseClient,
  stripeClient: Stripe
) {
  const subscription = event.data.object;
  const customer = (await stripeClient.customers.retrieve(
    subscription.customer
  )) as Stripe.Customer;

  const user = await createOrRetrieveUser(supabaseClient, customer);

  if (!user) {
    throw new Error(
      `Could not find user with customer_id ${subscription.customer}`
    );
  }

  const subscriptionId = subscription.id;
  const tiers = subscription.plan.tiers[0];

  if (tiers.up_to) {
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        credits: user.credits + tiers.up_to,
        subscription_id: subscriptionId
      })
      .eq('user_id', user.user_id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function handleSubscriptionUpdated(
  event: any,
  supabaseClient: SupabaseClient
) {
  const subscription = event.data.object;
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

  const subscriptionId = subscription.id;
  const tiers = subscription.plan.tiers[0];

  const isCancelingSubscription =
    subscription.cancel_at &&
    subscription.cancel_at_period_end &&
    subscription.canceled_at;

  if (!isCancelingSubscription && tiers.up_to) {
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        credits: user.credits + tiers.up_to,
        subscription_id: subscriptionId
      })
      .eq('user_id', user.user_id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function handleDeletedSubscribtion(
  event: any,
  supabaseClient: SupabaseClient
) {
  const subscription = event.data.object;
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
