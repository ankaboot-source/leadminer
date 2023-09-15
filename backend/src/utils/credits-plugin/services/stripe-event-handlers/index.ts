import Stripe from 'stripe';
import {
  StripeSubscriptionEvent,
  StripeEventHandler,
  StripeSubscriptionInvoiceEvent
} from './interfaces';
import StripeSubscriptionInvoicePaid from './invoicePaid';
import StripeSubscriptionDeleted from './subscriptionDeleted';
import { Users } from '../../database/interfaces/Users';

/**
 * Factory class for creating Stripe event handlers.
 */
export default class StripeEventHandlerFactory {
  constructor(
    private readonly userResolver: Users,
    private readonly stripeClient: Stripe
  ) {}

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
      case 'invoice.paid':
        return new StripeSubscriptionInvoicePaid(
          event as StripeSubscriptionInvoiceEvent,
          this.userResolver,
          this.stripeClient
        );

      case 'customer.subscription.deleted':
        return new StripeSubscriptionDeleted(
          event as StripeSubscriptionEvent,
          this.userResolver
        );
      default:
        return null;
    }
  }
}
