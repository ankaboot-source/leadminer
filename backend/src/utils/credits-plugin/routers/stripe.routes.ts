import { SupabaseClient } from '@supabase/supabase-js';
import express, { Router } from 'express';
import Stripe from 'stripe';
import { Logger } from 'winston';
import initializeStripePaymentController from '../controllers/stripe.controller';

export default function initializeStripePaymentRoutes(
  stripeClient: Stripe,
  supabaseClient: SupabaseClient,
  logger: Logger
) {
  const router = Router();
  const {
    stripeWebhookController,
    stripeHandleSuccessfulRedirectionController
  } = initializeStripePaymentController(stripeClient, supabaseClient, logger);

  router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    stripeWebhookController
  );

  router.get('/success', stripeHandleSuccessfulRedirectionController);

  return router;
}
