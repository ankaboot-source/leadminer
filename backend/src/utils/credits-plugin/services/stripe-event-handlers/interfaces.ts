import Stripe from 'stripe';

/**
 * Represents an event handler for Stripe events.
 */
export interface StripeEventHandler {
  handle(): Promise<void>;
}

/**
 * Represents an invoice Stripe event with specific data properties.
 */
export interface InvoiceEvent {
  data: {
    object: Stripe.Invoice;
  };
}
