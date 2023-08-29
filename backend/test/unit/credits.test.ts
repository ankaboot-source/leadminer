import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createCreditHandler } from '../../src/utils/billing/credits';
import { Users } from '../../src/db/interfaces/Users';
import { Profile } from '../../src/db/types';

describe('createCreditHandler', () => {
  let userResolverMock: Users;

  beforeEach(() => {
    userResolverMock = {
      getUserProfile: jest.fn(() => Promise.resolve(undefined)),
      updateUserProfile: jest.fn(() => Promise.resolve(undefined)),
      deleteUser: jest.fn(() => Promise.resolve(undefined)),
      deleteUserData: jest.fn(() => Promise.resolve(undefined))
    };
  });

  describe('createCreditHandler setup', () => {
    it('should return undefined when enable is false', () => {
      const creditHandler = createCreditHandler(false, 10, userResolverMock);
      expect(creditHandler).toBeUndefined();
    });

    it('should return undefined when creditsPerUnit is undefined', () => {
      const creditHandler = createCreditHandler(
        true,
        undefined,
        userResolverMock
      );
      expect(creditHandler).toBeUndefined();
    });

    it('should return validateCreditUsage and deductCredits methods when passing correct values', () => {
      const handler = createCreditHandler(true, 10, userResolverMock);

      if (handler === undefined) {
        throw new Error('Handler is undefined');
      }

      expect(typeof handler.validateCreditUsage).toBe('function');
      expect(typeof handler.deductCredits).toBe('function');
    });
  });

  describe('createCreditHandler.validateCreditUsage', () => {
    it('should return insufficientCredits when userCredits < CREDITS_PER_UNIT', async () => {
      userResolverMock.getUserProfile = jest.fn(() => Promise.resolve({ credits: 5 } as Profile))
      const creditHandler = createCreditHandler(true, 10, userResolverMock);

      const result = await creditHandler?.validateCreditUsage('userId', 3);

      expect(result?.insufficientCredits).toBe(true);
      expect(result?.requestedUnits).toBe(3);
      expect(result?.availableUnits).toBe(3);
    });

    it('should return availableUnits when userCredits >= CREDITS_PER_UNIT * units', async () => {
      userResolverMock.getUserProfile = jest.fn(() => Promise.resolve({ credits: 30 } as Profile))
      const creditHandler = createCreditHandler(true, 10, userResolverMock);

      const result = await creditHandler?.validateCreditUsage('userId', 3);

      expect(result?.insufficientCredits).toBe(false);
      expect(result?.requestedUnits).toBe(3);
      expect(result?.availableUnits).toBe(3);
    });


    it('should return availableUnits when userCredits < CREDITS_PER_UNIT * units', async () => {
      userResolverMock.getUserProfile = jest.fn(() => Promise.resolve({ credits: 20 } as Profile))
      const creditHandler = createCreditHandler(true, 10, userResolverMock);

      const result = await creditHandler?.validateCreditUsage('userId', 3);

      expect(result?.insufficientCredits).toBe(false);
      expect(result?.requestedUnits).toBe(3);
      expect(result?.availableUnits).toBe(2);
    });

  });

  describe('createCreditHandler.deductCredits', () => {
    it('should return true if profile udpated successfully', async () => {
      userResolverMock.getUserProfile = () => Promise.resolve({ credits: 30 } as Profile);
      userResolverMock.updateUserProfile = () => Promise.resolve(true);

      const creditHandler = createCreditHandler(true, 10, userResolverMock);
      const result = await creditHandler?.deductCredits('userId', 2);

      expect(result).toBe(true);
    });
  });
});