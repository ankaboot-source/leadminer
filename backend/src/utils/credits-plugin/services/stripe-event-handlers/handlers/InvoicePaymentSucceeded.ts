import Stripe from 'stripe';
import { Logger } from 'winston';
import { InvoiceEvent, StripeEventHandler } from '../interfaces';
import { Users } from '../../../database/interfaces/Users';
import StripeEventHandlerBase from './base';

/**
 * Handles the creation of a Stripe subscription.
 */
export default class InvoicePaymentSucceeded
  extends StripeEventHandlerBase
  implements StripeEventHandler
{
  constructor(
    private readonly event: InvoiceEvent,
    userResolver: Users,
    stripeClient: Stripe,
    logger: Logger
  ) {
    super(userResolver, stripeClient, logger);
  }

  async handle() {
    const invoice = this.event.data.object;
    const invoiceItem = invoice.lines.data.pop();

    let customer: Partial<Stripe.Customer> = {
      id: invoice.customer as string,
      email: invoice.customer_email,
      name: invoice.customer_name
    };

    const price = invoiceItem?.price;
    const quantity = invoiceItem?.quantity;
    const credits = price?.transform_quantity?.divide_by;

    if (!customer.id || typeof customer.id !== 'string') {
      throw new Error(
        'Unable process a paid invoice due to a missing customer id'
      );
    }

    if (!customer.email) {
      customer = (await this.stripeClient.customers.retrieve(
        customer.id
      )) as Stripe.Customer;
    }

    if (!customer.email) {
      throw new Error(
        'Unable process a paid invoice due to a missing customer details'
      );
    }

    if (!price || !quantity || !credits) {
      throw new Error(
        'Unable to process credits payment due to missing required params'
      );
    }

    let user = await this.userResolver.getByEmail(customer.email);

    if (!user) {
      user = await this.userResolver.create({
        email: customer.email,
        full_name: customer.name ?? '',
        stripe_customer_id: customer.id
      });

      this.logger.debug(
        `[${this.constructor.name}]: Successfully created profile with email "${customer.email}"`
      );

      const sendEmailInvite = await this.userResolver.inviteUserByEmail(
        user.email
      );

      if (sendEmailInvite instanceof Error) {
        this.logger.error(
          `[${this.constructor.name}]: Failed to send signup invitation to "${user.email}".`,
          sendEmailInvite.message
        );
      } else {
        this.logger.debug(
          `[${this.constructor.name}]: Successfully sent signup invitation to "${user.email}".`
        );
      }
    }

    const totalCredits = credits * (quantity >= 1 ? quantity : 1);

    await this.userResolver.update(user.user_id, {
      stripe_customer_id: customer.id,
      credits: user.credits + totalCredits
    });

    this.logger.debug(
      `[${this.constructor.name}]: Successfully updated profile with credits "${totalCredits}".`
    );
  }
}
