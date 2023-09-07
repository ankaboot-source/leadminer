import Stripe from 'stripe';

export default async function deleteCustomer(customerId: string) {
  if (!process.env.STRIPE_API_KEY) {
    return;
  }

  const stripeClient = new Stripe(process.env.STRIPE_API_KEY, {
    apiVersion: '2023-08-16'
  });

  await stripeClient.customers.del(customerId);
}
