import {
  jest,
  beforeEach,
  afterEach,
  expect,
  describe,
  it
} from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import CreditsHandler from '../../src/services/credits/creditHandler';
import SupabaseUsers from '../../src/db/supabase/users';
import { Profile } from '../../src/db/types';

const ENV_CONTACT_CREDITS = 10;
const MOCKED_DB = new Map<string, Partial<Profile>>([]);

jest.mock('../../src/db/supabase/users', () =>
  jest.fn().mockImplementation(() => ({
    getById: jest.fn((userId: string) =>
      Promise.resolve(MOCKED_DB.get(userId))
    ),
    update: jest.fn((userId: string, data: Partial<Profile>) => {
      MOCKED_DB.set(userId, data);
      return Promise.resolve(MOCKED_DB.get(userId));
    })
  }))
);

const mockedSupabaseUser = new SupabaseUsers(
  {} as SupabaseClient,
  {} as Logger
);

describe('CreditsHandler', () => {
  let creditsHandler: CreditsHandler;

  const USER_ID_WITH_ENOUGH_CREDITS = '1';
  const USER_ID_WITH_FEWER_CREDITS = '2';
  const USER_ID_WITH_INSUFFICIENT_CREDITS = '3';
  const INVALID_USER_ID = '4';

  beforeEach(() => {
    MOCKED_DB.set(USER_ID_WITH_FEWER_CREDITS, { credits: 20 });
    MOCKED_DB.set(USER_ID_WITH_ENOUGH_CREDITS, { credits: 1000 });
    MOCKED_DB.set(USER_ID_WITH_INSUFFICIENT_CREDITS, { credits: 0 });

    creditsHandler = new CreditsHandler(
      mockedSupabaseUser,
      ENV_CONTACT_CREDITS
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return no insufficient credits for a user with enough credits', async () => {
      const units = 5;
      const result = await creditsHandler.validate(
        USER_ID_WITH_ENOUGH_CREDITS,
        5
      );

      expect(result.insufficientCredits).toBe(false);
      expect(result.requestedUnits).toBe(units);
      expect(result.availableUnits).toBe(units);
    });

    it('should return all available units for a user with fewer credits', async () => {
      const units = 5;
      const userCredits = MOCKED_DB.get(USER_ID_WITH_FEWER_CREDITS)?.credits;
      const correctAvialableUnits = userCredits
        ? userCredits / ENV_CONTACT_CREDITS
        : 0;

      const result = await creditsHandler.validate(
        USER_ID_WITH_FEWER_CREDITS,
        units
      );

      expect(result.insufficientCredits).toBe(false);
      expect(result.requestedUnits).toBe(units);
      expect(result.availableUnits).toBe(correctAvialableUnits);
    });

    it('should return insufficient credits for a user with zero credits', async () => {
      const units = 5;
      const result = await creditsHandler.validate(
        USER_ID_WITH_INSUFFICIENT_CREDITS,
        units
      );

      expect(result.insufficientCredits).toBe(true);
      expect(result.requestedUnits).toBe(units);
      expect(result.availableUnits).toBe(0);
    });
  });

  describe('deduct', () => {
    it('should deduct credits from a user with sufficient credits', async () => {
      const userCredits = MOCKED_DB.get(USER_ID_WITH_ENOUGH_CREDITS)
        ?.credits as number;
      const unitsToDeduct = 5;

      const calcultedCredit = userCredits - unitsToDeduct * ENV_CONTACT_CREDITS;
      const updatedUserAccount = await creditsHandler.deduct(
        USER_ID_WITH_ENOUGH_CREDITS,
        unitsToDeduct
      );

      expect(mockedSupabaseUser.update).toHaveBeenCalledWith(
        USER_ID_WITH_ENOUGH_CREDITS,
        { credits: calcultedCredit }
      );
      expect(updatedUserAccount).toEqual({ credits: calcultedCredit });
    });

    it('should set credits to zero if user has insufficient credits', async () => {
      await creditsHandler.deduct(USER_ID_WITH_INSUFFICIENT_CREDITS, 5);

      expect(mockedSupabaseUser.update).toHaveBeenCalledWith(
        USER_ID_WITH_INSUFFICIENT_CREDITS,
        { credits: 0 }
      );
      expect(MOCKED_DB.get(USER_ID_WITH_INSUFFICIENT_CREDITS)).toEqual({
        credits: 0
      });
    });

    it('should throw an error if user credits cannot be retrieved', async () => {
      await expect(creditsHandler.deduct(INVALID_USER_ID, 5)).rejects.toThrow(
        'Failed to retrieve user credits.'
      );
    });

    it('should throw an error if credit deduction fails', async () => {
      mockedSupabaseUser.update = () => Promise.resolve(undefined);

      await expect(
        creditsHandler.deduct(USER_ID_WITH_ENOUGH_CREDITS, 15)
      ).rejects.toThrow('Failed to update user credits.');
    });
  });
});
