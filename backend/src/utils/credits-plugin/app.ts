import express from 'express';
import Stripe from 'stripe';
import { Logger } from 'winston';
import { SupabaseClient } from '@supabase/supabase-js';
import initializeStripePaymentRoutes from './routers/stripe.routes';

export default function initPaymentApp(
  supabaseClient: SupabaseClient,
  logger: Logger
) {
  if (
    !process.env.ENABLE_CREDIT ||
    !process.env.STRIPE_API_KEY ||
    !process.env.STRIPE_WEBHOOK_SECRET
  ) {
    return null;
  }

  const app = express();

  app.on('mount', () =>
    logger.info('Credit payment app mounted successfully ✔️')
  );

  const stripeClient = new Stripe(process.env.STRIPE_API_KEY, {
    apiVersion: '2023-08-16'
  });

  app.use(
    '/payment/stripe',
    initializeStripePaymentRoutes(stripeClient, supabaseClient, logger)
  );

  return app;
}
