import Stripe from 'stripe';
import { StripeSubscriptionInvoiceEvent } from './interfaces';
import { Profile, Users } from '../../database/interfaces/Users';

/**
 * Handles the creation of a Stripe subscription.
 */
export default class StripeSubscriptionInvoicePaid {
  constructor(
    private readonly event: StripeSubscriptionInvoiceEvent,
    private readonly userResolver: Users,
    private readonly stripeClient: Stripe
  ) {}

  async handle() {
    const invoice = this.event.data.object;
    const invoiceItem = invoice.lines.data.pop();

    const customer = await this.getCustomer(invoice.customer);
    const user = await this.createOrRetrieveUser(customer);

    const { subscription } = invoice;

    const plan = invoiceItem?.plan;
    const price = invoiceItem?.price;

    const packageCredits = !plan && price?.transform_quantity?.divide_by;

    if (packageCredits) {
      await this.userResolver.update(user.user_id, {
        credits: user.credits + packageCredits
      });
    } else if (subscription && plan) {
      const subscriptionCredits = await this.getSubscriptionCredits(plan);
      await this.userResolver.update(user.user_id, {
        credits: user.credits + subscriptionCredits,
        stripe_subscription_id: invoice.subscription
      });
    }
  }

  private async createOrRetrieveUser(
    customer: Stripe.Customer
  ): Promise<Profile> {
    if (!customer.id || !customer.email) {
      throw new Error('Missing required customerID and customerEmail.');
    }

    const user = await this.userResolver.create(customer.email, customer.name);

    if (user.stripe_customer_id === null) {
      await this.userResolver.update(user.user_id, {
        stripe_customer_id: customer.id
      });
    }

    return user;
  }

  private async getCustomer(customerId: string): Promise<Stripe.Customer> {
    const customer = await this.stripeClient.customers.retrieve(customerId);

    if (!customer) {
      throw new Error(`Customer not found with ID: ${customerId}`);
    }

    return customer as Stripe.Customer;
  }

  private async getSubscriptionCredits(subscriptionPlan: Stripe.Plan) {
    const plan = await this.stripeClient.plans.retrieve(subscriptionPlan.id, {
      expand: ['tiers']
    });
    const credits = plan.tiers?.[0].up_to;

    if (!credits) {
      throw new Error(
        `Failed to parse credits from subscription plan: ${plan.id}`
      );
    }

    return credits;
  }
}
