import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { Express } from 'express';
import ENV from '../config';
// skipcq: JS-C1003
import * as DynamicCreditPlugin from './credits-plugin/index';
import { Profile } from '../db/types';

interface UserResololver {
  getUserProfile(userId: string): Promise<Profile | undefined>;
  updateUserProfile(
    userId: string,
    updateData?: Partial<Profile> | undefined
  ): Promise<boolean | undefined>;
}

interface CreditsPlugin {
  initPaymentApp(
    supabaseClient: SupabaseClient,
    logger: Logger
  ): Express | null;
  createCreditHandler(
    creditsPerUnit: number | undefined,
    userResolver: UserResololver
  ): {
    INSUFFICIENT_CREDITS_STATUS: number;
    INSUFFICIENT_CREDITS_MESSAGE: string;
    validateCreditUsage(
      userId: string,
      units: number
    ): Promise<{
      insufficientCredits: boolean;
      requestedUnits: number;
      availableUnits: number;
    }>;
    deductCredits(userId: string, units: number): Promise<true>;
    addCredits(userId: string, credits: number): Promise<true>;
  };
  deleteCustomer(customerId: string): Promise<void>;
}

const plugin = DynamicCreditPlugin as CreditsPlugin;

export const initPaymentApp = plugin.initPaymentApp ?? (() => null);
export const createCreditHandler = plugin.createCreditHandler ?? (() => null);
export const deleteCustomer = plugin.deleteCustomer ?? (() => null);

export function verifyCreditEnvironmentVariables() {
  if (!ENV.ENABLE_CREDIT) {
    return;
  }

  if (!ENV.CONTACT_CREDIT) {
    throw new Error('Missing environment variable CONTACT_CREDIT');
  }

  if (!ENV.EMAIL_CREDIT) {
    throw new Error('Missing environment variable EMAIL_CREDIT');
  }

  if (!ENV.STRIPE_API_KEY) {
    throw new Error('Missing environment variable STRIPE_API_KEY');
  }

  if (!ENV.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Missing environment variable STRIPE_WEBHOOK_SECRET');
  }
}
