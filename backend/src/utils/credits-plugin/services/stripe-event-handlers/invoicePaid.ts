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

    if (!customer.email) {
      throw new Error('Missing customer email.');
    }

    const user = await this.userResolver.getByEmail(customer.email);

    if (!user) {
      throw new Error(
        `Profile associated with email "${customer.email}" not found!`
      );
    }

    if (user.stripe_customer_id === null) {
      await this.userResolver.update(user.user_id, {
        stripe_customer_id: customer.id
      });
    }

    const { subscription } = invoice;

    const plan = invoiceItem?.plan;
    const price = invoiceItem?.price;

    const packageCredits = !plan && price?.transform_quantity?.divide_by;

    let profileData: Partial<Profile> = {
      stripe_customer_id: customer.id
    };

    if (packageCredits) {
      const quantity = invoiceItem?.quantity;
      const totalCredits =
        packageCredits * (quantity && quantity >= 1 ? quantity : 1);
      profileData = {
        ...profileData,
        credits: user.credits + totalCredits
      };
    } else if (subscription && plan) {
      const subscriptionCredits = await this.getSubscriptionCredits(plan);
      profileData = {
        ...profileData,
        credits: user.credits + subscriptionCredits,
        stripe_subscription_id: invoice.subscription
      };
    }
    await this.userResolver.update(user.user_id, profileData);
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
