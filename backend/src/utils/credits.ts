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
  initPaymentRouter(
    supabaseClient: SupabaseClient,
    logger: Logger
  ): Express;
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

let plugin = {} as CreditsPlugin;

if (ENV.ENABLE_CREDIT) {
  plugin = DynamicCreditPlugin as CreditsPlugin;
}

export const initPaymentRouter = plugin.initPaymentRouter ?? (() => null);
export const createCreditHandler = plugin.createCreditHandler ?? (() => null);
export const deleteCustomer = plugin.deleteCustomer ?? (() => null);