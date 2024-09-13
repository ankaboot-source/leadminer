import { NextFunction, Request, Response } from 'express';
import { Logger } from 'winston';
import Stripe from 'stripe';
import ENV from '../config';

import StripeEventHandlerFactory from '../services/stripe-event-handlers';
import { Users } from '../database/interfaces/Users';

export default function initializeStripePaymentController(
  stripeResolver: Stripe,
  accountResolver: Users,
  logger: Logger
) {
  return {
    async stripeWebhookController(
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      try {
        const signature = req.headers['stripe-signature'];

        if (!signature) {
          logger.error('Missing stripe signature or WEBHOOK_ENDPOINT_SECRET');
          return res.sendStatus(500);
        }

        const event = stripeResolver.webhooks.constructEvent(
          req.body,
          signature,
          ENV.STRIPE_WEBHOOK_SECRET
        );

        if (!event) {
          return res.sendStatus(400);
        }

        const eventHandler = new StripeEventHandlerFactory(
          accountResolver,
          stripeResolver,
          logger
        ).create(event.type, event);

        if (eventHandler) {
          logger.info(`Handeling event type: ${event.type}`);
          await eventHandler.handle();
        } else {
          logger.warn(`Unhandled event type: ${event.type}`);
        }

        return res.sendStatus(200);
      } catch (err) {
        return next(err);
      }
    },

    async stripeHandleSuccessfulRedirectionController(
      req: Request,
      res: Response
    ) {
      try {
        const baseUrl = `${ENV.FRONTEND_HOST}/credits-success`;
        const stripeCheckoutSessionId = req.query.checkout_session_id as
          | string
          | undefined;

        if (!stripeCheckoutSessionId) {
          return res
            .status(400)
            .json({ message: 'Missing query parameter "checkout_session_id"' });
        }

        const session = await stripeResolver.checkout.sessions.retrieve(
          stripeCheckoutSessionId,
          { expand: ['line_items.data.price.tiers'] }
        );

        if (session.customer === null) {
          throw new Error('customer was not provided.');
        }

        const customer = {
          id:
            typeof session.customer === 'string'
              ? session.customer
              : session.customer.id,
          ...session.customer_details
        };

        logger.debug(
          '[after_payment_redirect]: Getting stripe customer details',
          customer
        );

        if (!customer?.email) {
          throw new Error('Request from Stripe is missing customer email');
        }

        const redirectParams: Record<string, string> = {
          is_subscription: 'false'
        };

        const plan = session.line_items?.data[0].price;
        const credits =
          plan?.transform_quantity?.divide_by ?? plan?.tiers?.[0].up_to;

        if (!credits) {
          throw Error('Missing credits.');
        }

        redirectParams.credits = credits.toString();

        let user = await accountResolver.getByEmail(customer.email);

        if (!user) {
          user = await accountResolver.create({
            email: customer.email,
            full_name: customer.name ?? '',
            stripe_customer_id: customer.id,
            credits
          });

          logger.debug(
            '[after_payment_redirect]: Created profile from customer details ',
            {
              email: customer.email,
              stripe_customer_id: customer.id,
              stripe_subscription_id: session.subscription as string,
              credits
            }
          );

          const inviteUserError = await accountResolver.inviteUserByEmail(
            customer.email
          );

          if (inviteUserError instanceof Error) {
            logger.error(
              `[after_payment_redirect]: Failed to send signup invitation to "${user.email}".`
            );
          } else {
            logger.debug(
              `[after_payment_redirect]: Successfully sent signup invitation to "${user.email}"`
            );
          }
        }

        const actionLink = await accountResolver.generateMagicLink(user.email);

        logger.debug(
          `[after_payment_redirect]: Successfully created magiclink to signin for "${user.email}"`
        );

        redirectParams.redirect_to = actionLink;
        const redirectURL = `${baseUrl}?${new URLSearchParams(
          redirectParams
        ).toString()}`;

        return res.redirect(redirectURL);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`[after_payment_redirect]: ${error.message}`);
        }
        return res.redirect(ENV.FRONTEND_HOST);
      }
    }
  };
}
