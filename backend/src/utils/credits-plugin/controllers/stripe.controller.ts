import { NextFunction, Request, Response } from 'express';
import { Logger } from 'winston';
import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  handleDeletedSubscribtion,
  handleSubscriptionCreated,
  handleSubscriptionUpdated
} from '../utils/eventHandlers';
import ENV from '../config';

export default function initializeStripePaymentController(
  stripeClient: Stripe,
  supabaseClient: SupabaseClient,
  logger: Logger
) {
  return {
    async stripeWebhookController(
      req: Request,
      res: Response,
      next: NextFunction
    ) {

      if (!ENV.STRIPE_WEBHOOK_SECRET) {
        throw new Error('Missing stripe WEBHOOK_ENDPOINT_SECRET')
      }

      try {
        const signature = req.headers['stripe-signature'];

        if (!signature) {
          logger.error('Missing stripe signature or WEBHOOK_ENDPOINT_SECRET');
          return res.sendStatus(500);
        }

        const event = stripeClient.webhooks.constructEvent(
          req.body,
          signature,
          ENV.STRIPE_WEBHOOK_SECRET
        );

        if (!event) {
          return res.sendStatus(400);
        }

        switch (event.type) {
          case 'customer.subscription.updated':
            logger.info(`Handling event type ${event.type}`);
            await handleSubscriptionUpdated(event, supabaseClient);
            break;
          case 'customer.subscription.created':
            logger.info(`Handling event type ${event.type}`);
            await handleSubscriptionCreated(
              event,
              supabaseClient,
              stripeClient
            );
            break;
          case 'customer.subscription.deleted':
            logger.info(`Handling event type ${event.type}`);
            await handleDeletedSubscribtion(event, supabaseClient);
            break;
          default:
            logger.warn(`Unhandled event type ${event.type}`);
        }
        // Return a 200 response to acknowledge receipt of the event
        return res.sendStatus(200);
      } catch (err) {
        return next(err);
      }
    },

    async stripeHandleSuccessfulRedirectionController(
      req: Request,
      res: Response
    ) {

      if(!ENV.FRONTEND_HOST) {
        throw new Error('Missing env FRONTEND_HOST.')
      }

      try {
        const stripeCheckoutSessionId = req.query.checkout_session_id as string;

        if (!stripeCheckoutSessionId) {
          return res
            .status(400)
            .json({ message: 'Missing query parameter "checkout_session_id"' });
        }

        const session = await stripeClient.checkout.sessions.retrieve(
          stripeCheckoutSessionId
        );
        const customer = session.customer_details;

        if (!customer?.email) {
          throw new Error('Request from Stripe is missing customer email');
        }

        const { error: inviteUserError } =
          await supabaseClient.auth.admin.inviteUserByEmail(customer.email);

        if (inviteUserError) {
          logger.error(
            `An error occurred when sending the invitation: ${inviteUserError.message}`
          );
        }

        const { data, error } = await supabaseClient.auth.admin.generateLink({
          type: 'magiclink',
          email: customer.email
        });

        if (error) {
          throw new Error(error.message);
        }

        const redirectionURL = data.properties.action_link;
        return res.redirect(redirectionURL);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`An error occurred: ${error.message}`);
        }

        return res.redirect(ENV.FRONTEND_HOST as string);
      }
    }
  };
}
