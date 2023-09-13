import express, { Router } from 'express';
import Stripe from 'stripe';
import { Logger } from 'winston';
import initializeStripePaymentController from '../controllers/stripe.controller';
import { Users } from '../database/interfaces/Users';

export default function initializeStripePaymentRoutes(
  stripeClient: Stripe,
  accountsResolver: Users,
  logger: Logger
) {
  const router = Router();
  const {
    stripeWebhookController,
    stripeHandleSuccessfulRedirectionController
  } = initializeStripePaymentController(stripeClient, accountsResolver, logger);

  router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    stripeWebhookController
  );

  router.get('/success', stripeHandleSuccessfulRedirectionController);

  return router;
}
