import Stripe from 'stripe';
import ENV from '../config';

export default async function deleteCustomer(customerId: string) {
  if (!ENV.STRIPE_API_KEY) {
    return;
  }

  const stripeClient = new Stripe(ENV.STRIPE_API_KEY, {
    // @ts-expect-error: Suppresses TypeScript error because the "apiVersion" is typed with latest Stripe version
    apiVersion: ENV.STRIPE_API_VERSION
  });

  await stripeClient.customers.del(customerId);
}
