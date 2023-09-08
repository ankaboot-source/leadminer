import Stripe from 'stripe';

/**
 * Represents an event handler for Stripe events.
 */
export interface StripeEventHandler {
  handle(): Promise<void>;
}

/**
 * Represents a Stripe event with specific data properties.
 */
export interface StripeEvent extends Stripe.Event {
  data: {
    object: {
      id: string;
      customer: string;
      plan: Stripe.Plan;
      cancel_at: number;
      cancel_at_period_end: number;
      canceled_at: number;
    };
  };
}
