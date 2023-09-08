import Stripe from 'stripe';
import ENV from '../config';

export default async function deleteCustomer(customerId: string) {
  if (!ENV.STRIPE_API_KEY) {
    return;
  }

  const stripeClient = new Stripe(ENV.STRIPE_API_KEY, {
    // @ts-ignore
    apiVersion: ENV.STRIPE_API_VERSION
  });

  await stripeClient.customers.del(customerId);
}
