import Stripe from 'stripe';
import express from 'express';
import { Logger } from 'winston';
import { createClient } from '@supabase/supabase-js';
import { Users } from './database/interfaces/Users';
import ENV from './config';
import initializeStripePaymentRoutes from './routers/stripe.routes';
import SupabaseUsers from './database/SupabaseUsersResolver';

function initCreditAndPaymentPlugin(stripeClient: Stripe, userResolver: Users) {
  const STRIPE_CLIENT = stripeClient;
  const USER_RESOLVER = userResolver;

  return {
    customerHandler() {
      return {
        async delete(customerId: string) {
          await STRIPE_CLIENT.customers.del(customerId);
        }
      };
    },

    initCreditAndPaymentRoutes(logger: Logger) {
      const router = express.Router();

      router.use(
        '/payment/stripe',
        initializeStripePaymentRoutes(STRIPE_CLIENT, USER_RESOLVER, logger)
      );

      logger.info('Credits routes mounted successfully ✔️');

      return router;
    }
  };
}

const supabaseAccounts = new SupabaseUsers(
  createClient(ENV.SUPABASE_PROJECT_URL, ENV.SUPABASE_SECRET_PROJECT_TOKEN, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
);

const stripeClient = new Stripe(ENV.STRIPE_API_KEY, {
  // @ts-expect-error: Suppresses TypeScript error because the "apiVersion"
  // is typed with latest Stripe version
  apiVersion: ENV.STRIPE_API_VERSION
});

const plugin = initCreditAndPaymentPlugin(stripeClient, supabaseAccounts);

export default plugin;
