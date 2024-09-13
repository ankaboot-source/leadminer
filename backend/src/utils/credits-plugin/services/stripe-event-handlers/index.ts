import Stripe from 'stripe';
import { Logger } from 'winston';
import { StripeEventHandler, InvoiceEvent } from './interfaces';
import InvoicePaymentSucceeded from './handlers/InvoicePaymentSucceeded';
import { Users } from '../../database/interfaces/Users';
import StripeEventHandlerBase from './handlers/base';

/**
 * Factory class for creating Stripe event handlers.
 */
export default class StripeEventHandlerFactory extends StripeEventHandlerBase {
  constructor(
    protected readonly userResolver: Users,
    protected readonly stripeClient: Stripe,
    protected readonly logger: Logger
  ) {
    super(userResolver, stripeClient, logger);
  }

  /**
   * Create a Stripe event handler based on the event type.
   * @param eventType - The type of the Stripe event.
   * @param event - The Stripe event object.
   * @returns A StripeEventHandler instance or null if the event type is not recognized.
   */
  create(
    eventType: Stripe.Event.Type,
    event: Stripe.Event
  ): StripeEventHandler | null {
    switch (eventType) {
      case 'invoice.payment_succeeded':
        return new InvoicePaymentSucceeded(
          event as InvoiceEvent,
          this.userResolver,
          this.stripeClient,
          this.logger
        );
      default:
        return null;
    }
  }
}
