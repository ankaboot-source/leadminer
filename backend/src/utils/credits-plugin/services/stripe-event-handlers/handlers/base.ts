import Stripe from 'stripe';
import { Logger } from 'winston';
import { Users } from '../../../database/interfaces/Users';

export default class StripeEventHandlerBase {
  constructor(
    protected readonly userResolver: Users,
    protected readonly stripeClient: Stripe,
    protected readonly logger: Logger
  ) {}
}
