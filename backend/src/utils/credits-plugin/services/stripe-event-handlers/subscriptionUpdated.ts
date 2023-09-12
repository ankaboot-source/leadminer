import { StripeSubscriptionEvent, StripeEventHandler } from './interfaces';
import { Users } from '../../database/interfaces/Users';

/**
 * Handles Stripe subscription updates.
 */
export default class StripeSubscriptionUpdated implements StripeEventHandler {
  constructor(
    private readonly event: StripeSubscriptionEvent,
    private readonly userResolver: Users
  ) {}

  async handle(): Promise<void> {
    const subscription = this.event.data.object;
    const tiers = subscription.plan.tiers?.[0];
    const prevAttributes = this.event.data.previous_attributes;

    if (!tiers?.up_to) {
      return;
    }

    if (
      (subscription.status === 'active' && subscription.cancel_at_period_end) ||
      (prevAttributes && prevAttributes.cancel_at_period_end)
    ) {
      return;
    }

    const user = await this.userResolver.getBySubscriptionId(subscription.id);

    if (!user) {
      return;
    }

    await this.userResolver.update(user.user_id, {
      credits: user.credits + tiers.up_to,
      stripe_subscription_id: subscription.id
    });
  }
}
