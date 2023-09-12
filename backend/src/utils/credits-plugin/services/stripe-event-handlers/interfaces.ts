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
export interface StripeSubscriptionEvent extends Stripe.Event {
  data: {
    object: {
      id: string;
      customer: string;
      plan: Stripe.Plan;
      cancel_at: number;
      cancel_at_period_end: number;
      canceled_at: number;
      status: string;
    };
    previous_attributes?: Record<string, any>;
  };
}
