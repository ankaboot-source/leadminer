import { StripeSubscriptionEvent, StripeEventHandler } from './interfaces';
import { Users } from '../../database/interfaces/Users';

/**
 * Handles the deletion of a Stripe subscription.
 */
export default class StripeSubscriptionDeleted implements StripeEventHandler {
  constructor(
    private readonly event: StripeSubscriptionEvent,
    private readonly userResolver: Users
  ) {}

  async handle(): Promise<void> {
    const subscription = this.event.data.object;
    const user = await this.userResolver.getBySubscriptionId(subscription.id);

    if (!user) {
      return;
    }

    await this.userResolver.update(user.user_id, {
      stripe_subscription_id: null
    });
  }
}
