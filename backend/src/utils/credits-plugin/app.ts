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
    !ENV.STRIPE_API_KEY
  ) {
    return null;
  }

  const stripeClient = new Stripe(ENV.STRIPE_API_KEY, {
    // @ts-ignore
    apiVersion: ENV.STRIPE_API_VERSION
  });

  app.use(
    '/payment/stripe',
    initializeStripePaymentRoutes(stripeClient, supabaseClient, logger)
  );

  return app;
}
