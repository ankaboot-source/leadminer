import { Logger } from 'winston';
import { Express } from 'express';
import ENV from '../config';
import logger from './logger';

interface CreditsPlugin {
  initCreditAndPaymentRoutes(logger: Logger): Express;
  customerHandler(): {
    delete(customerId: string): Promise<void>;
  };
}

let plugin = {} as CreditsPlugin;

if (ENV.ENABLE_CREDIT) {
  try {
    /* eslint-disable global-require */
    // skipcq: JS-0359 - Can't use import here
    plugin = require('./credits-plugin').default as CreditsPlugin;
  } catch (err) {
    if (err instanceof Error) {
      logger.error(`Failed to load package credits-plugin: ${err.message}`);
    }
  }
}

export const initCreditAndPaymentRoutes =
  plugin.initCreditAndPaymentRoutes ?? (() => null);
export const customerHandler = plugin.customerHandler ?? (() => null);
