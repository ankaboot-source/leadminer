import { describe, jest, beforeEach, it, expect } from '@jest/globals';
import SignatureExtractorCache from '../../../src/services/signature/llm/signature-extractor-cache';
import {
  ExtractSignature,
  PersonLD
} from '../../../src/services/signature/types';

describe('SignatureExtractorCache', () => {
  let mockWrapped: jest.Mocked<ExtractSignature>;
  let mockRedis: { get: jest.Mock; setex: jest.Mock };
  const ttl = 3600;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWrapped = {
      isActive: jest.fn(),
      extract: jest.fn()
    };
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn()
    };
  });

  describe('extract', () => {
    it('should return cached result when exists', async () => {
      const cachedPerson = { name: 'John Doe' } as PersonLD;
      mockWrapped.isActive.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPerson));

      const cache = new SignatureExtractorCache(
        mockWrapped,
        mockRedis as any,
        ttl
      );
      const result = await cache.extract('test@example.com', 'signature');

      expect(result).toEqual(cachedPerson);
      expect(mockWrapped.extract).not.toHaveBeenCalled();
    });

    it('should call wrapped.extract when cache miss', async () => {
      const person = { name: 'John Doe' } as PersonLD;
      mockWrapped.isActive.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockWrapped.extract.mockResolvedValue(person);

      const cache = new SignatureExtractorCache(
        mockWrapped,
        mockRedis as any,
        ttl
      );
      const result = await cache.extract('test@example.com', 'signature');

      expect(result).toEqual(person);
      expect(mockWrapped.extract).toHaveBeenCalledWith(
        'test@example.com',
        'signature'
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('llm-sig:'),
        ttl,
        JSON.stringify(person)
      );
    });

    it('should not cache null results', async () => {
      mockWrapped.isActive.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockWrapped.extract.mockResolvedValue(null);

      const cache = new SignatureExtractorCache(
        mockWrapped,
        mockRedis as any,
        ttl
      );
      const result = await cache.extract('test@example.com', 'signature');

      expect(result).toBeNull();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should generate consistent cache keys for same signature', async () => {
      const person = { name: 'John Doe' } as PersonLD;
      mockWrapped.isActive.mockReturnValue(true);
      let callCount = 0;
      mockRedis.get.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) return Promise.resolve(null);
        return Promise.resolve(JSON.stringify(person));
      });
      mockWrapped.extract.mockResolvedValue(person);

      const cache = new SignatureExtractorCache(
        mockWrapped,
        mockRedis as any,
        ttl
      );
      await cache.extract('test@example.com', 'signature');
      await cache.extract('test@example.com', 'signature');

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    });

    it('should generate different cache keys for different signatures', async () => {
      const person = { name: 'John Doe' } as PersonLD;
      mockWrapped.isActive.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockWrapped.extract.mockResolvedValue(person);

      const cache = new SignatureExtractorCache(
        mockWrapped,
        mockRedis as any,
        ttl
      );
      await cache.extract('test@example.com', 'signature1');
      await cache.extract('test@example.com', 'signature2');

      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
    });
  });

  describe('isActive', () => {
    it('should delegate isActive to wrapped', () => {
      mockWrapped.isActive.mockReturnValue(true);
      const cache = new SignatureExtractorCache(
        mockWrapped,
        mockRedis as any,
        ttl
      );
      expect(cache.isActive()).toBe(true);
      expect(mockWrapped.isActive).toHaveBeenCalled();
    });

    it('should return false when wrapped is inactive', () => {
      mockWrapped.isActive.mockReturnValue(false);
      const cache = new SignatureExtractorCache(
        mockWrapped,
        mockRedis as any,
        ttl
      );
      expect(cache.isActive()).toBe(false);
      expect(mockWrapped.isActive).toHaveBeenCalled();
    });
  });
});
