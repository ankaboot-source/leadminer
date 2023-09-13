import Stripe from 'stripe';
import { StripeSubscriptionEvent, StripeEventHandler } from './interfaces';
import { Users } from '../../database/interfaces/Users';

/**
 * Handles the creation of a Stripe subscription.
 */
export default class StripeSubscriptionCreated implements StripeEventHandler {
  constructor(
    private readonly event: StripeSubscriptionEvent,
    private readonly userResolver: Users,
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
      await this.userResolver.update(user.user_id, {
        credits: user.credits + tiers.up_to,
        stripe_subscription_id: subscription.id
      });
    }
  }

  private async createOrRetrieveUser(customer: Stripe.Customer) {
    if (!customer.id || !customer.email) {
      throw new Error('Missing required customerID and customerEmail.');
    }

    const user = await this.userResolver.create(customer.email, customer.name);

    return user.stripe_customer_id === null
      ? this.userResolver.update(user.user_id, {
          stripe_customer_id: customer.id
        })
      : user;
  }
}
