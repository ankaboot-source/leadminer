import { describe, it, jest, expect } from '@jest/globals';
import { validateToken } from '../../src/utils/helpers/tokenHelpers';

describe('validateToken', () => {
  it('should return true if the token is valid', async () => {
    const mockVerify = jest.fn().mockReturnValue(true);
    const result = await validateToken(mockVerify, 'valid-token');

    expect(mockVerify).toHaveBeenCalledWith('valid-token');
    expect(result).toBe(true);
  });

  it('should return false if the token is invalid', async () => {
    const mockVerify = () => {
      throw new Error('invalid');
    };
    const result = await validateToken(mockVerify, 'invalid-token');

    expect(result).toBe(false);
  });
});
