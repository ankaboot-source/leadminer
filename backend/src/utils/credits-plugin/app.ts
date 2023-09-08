import express from 'express';
import Stripe from 'stripe';
import { Logger } from 'winston';
import { SupabaseClient } from '@supabase/supabase-js';
import initializeStripePaymentRoutes from './routers/stripe.routes';
import ENV from './config';

export default function initPaymentRouter(
  supabaseClient: SupabaseClient,
  logger: Logger
) {
  if (!ENV.STRIPE_API_KEY) {
    return null;
  }

  const router = express.Router();

  const stripeClient = new Stripe(ENV.STRIPE_API_KEY, {
    // @ts-ignore
    apiVersion: ENV.STRIPE_API_VERSION
  });

  router.use(
    '/payment/stripe',
    initializeStripePaymentRoutes(stripeClient, supabaseClient, logger)
  );

  logger.info('Credits router mounted successfully ✔️');

  return router;
}
