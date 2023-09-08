import { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { StripeEvent, StripeEventHandler } from './types';
import StripeSubscriptionCreated from './stripeSubscriptionCreated';
import StripeSubscriptionUpdated from './stripeSubscriptionUpdated';
import StripeSubscriptionDeleted from './stripeSubscriptionDeleted';
import SupabaseProfiles from '../../db/SupabaseProfiles';

/**
 * Factory class for creating Stripe event handlers.
 */
export default class StripeEventHandlerFactory {
  constructor(
    private readonly supabaseClient: SupabaseClient,
    private readonly stripeClient?: Stripe
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
    const supabaseClient = new SupabaseProfiles(this.supabaseClient);

    switch (eventType) {
      case 'customer.subscription.created':
        return new StripeSubscriptionCreated(
          event as StripeEvent,
          supabaseClient,
          this.stripeClient!
        );
      case 'customer.subscription.updated':
        return new StripeSubscriptionUpdated(
          event as StripeEvent,
          supabaseClient
        );
      case 'customer.subscription.deleted':
        return new StripeSubscriptionDeleted(
          event as StripeEvent,
          supabaseClient
        );
      default:
        return null;
    }
  }
}
