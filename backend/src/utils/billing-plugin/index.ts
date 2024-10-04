import { Logger } from 'winston';
import { Router } from 'express';

interface IBilling {
  validateCustomerCredits(
    userId: string,
    units: number
  ): Promise<{
    hasDeficientCredits: boolean;
    hasInsufficientCredits: boolean;
    requestedUnits: number;
    availableUnits: number;
  }>;
  deductCustomerCredits(userId: string, units: number): Promise<void>;
  deleteCustomer(userId: string): Promise<void>;
  expressRouter(logger: Logger): Router;
}

const Billing: IBilling | null = null;
export default Billing;
