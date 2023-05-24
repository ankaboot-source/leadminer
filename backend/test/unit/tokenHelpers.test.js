import { describe, it, jest, expect } from '@jest/globals';
import { validateToken } from '../../src/utils/helpers/tokenHelpers';

describe('validateToken', () => {
  it('returns true when the token is valid', async () => {
    const mockVerify = jest.fn().mockResolvedValueOnce();
    const result = await validateToken(mockVerify, 'validToken');

    expect(result).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith('validToken');
  });

  it('returns false when the token is invalid', async () => {
    const mockVerify = jest
      .fn()
      .mockRejectedValueOnce(new Error('Invalid token'));
    const result = await validateToken(mockVerify, 'invalidToken');

    expect(result).toBe(false);
    expect(mockVerify).toHaveBeenCalledWith('invalidToken');
  });
});
