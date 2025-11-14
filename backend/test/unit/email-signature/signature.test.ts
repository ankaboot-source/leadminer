import { Logger } from 'winston';
import { describe, jest, beforeEach, it, expect } from '@jest/globals';
import { EngineConfig, Signature } from '../../../src/services/signature';
import {
  ExtractSignature,
  PersonLD
} from '../../../src/services/signature/types';

describe('Signature', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockPrimaryEngine: jest.Mocked<ExtractSignature>;
  let mockFallbackEngine: jest.Mocked<ExtractSignature>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    } as any;

    mockPrimaryEngine = {
      isActive: jest.fn(),
      extract: jest.fn()
    };

    mockFallbackEngine = {
      isActive: jest.fn(),
      extract: jest.fn()
    };
  });

  it('should log initialized engines correctly', () => {
    mockPrimaryEngine.isActive.mockReturnValue(true);
    mockFallbackEngine.isActive.mockReturnValue(true);

    const engines: EngineConfig[] = [
      { engine: mockPrimaryEngine, useAsFallback: false },
      { engine: mockFallbackEngine, useAsFallback: true }
    ];

    new Signature(mockLogger, engines);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Signature extractor initialized',
      expect.objectContaining({
        primary: expect.any(String),
        fallback: expect.any(String)
      })
    );
  });

  it('should use the primary engine when active', async () => {
    mockPrimaryEngine.isActive.mockReturnValue(true);
    mockFallbackEngine.isActive.mockReturnValue(true);
    mockPrimaryEngine.extract.mockResolvedValue({
      name: 'John Doe'
    } as PersonLD);

    const signature = new Signature(mockLogger, [
      { engine: mockPrimaryEngine, useAsFallback: false },
      { engine: mockFallbackEngine, useAsFallback: true }
    ]);

    const result = await signature.extract('signature text');
    expect(mockPrimaryEngine.extract).toHaveBeenCalledWith('signature text');
    expect(result).toEqual({ name: 'John Doe' });
  });

  it('should fall back to fallback engine when primary inactive', async () => {
    mockPrimaryEngine.isActive.mockReturnValue(false);
    mockFallbackEngine.isActive.mockReturnValue(true);
    mockFallbackEngine.extract.mockResolvedValue({
      name: 'Fallback'
    } as PersonLD);

    const signature = new Signature(mockLogger, [
      { engine: mockPrimaryEngine, useAsFallback: false },
      { engine: mockFallbackEngine, useAsFallback: true }
    ]);

    const result = await signature.extract('sig');
    expect(mockFallbackEngine.extract).toHaveBeenCalledWith('sig');
    expect(result).toEqual({ name: 'Fallback' });
  });

  it('should return null and log error if no engines active', async () => {
    mockPrimaryEngine.isActive.mockReturnValue(false);
    mockFallbackEngine.isActive.mockReturnValue(false);

    const signature = new Signature(mockLogger, [
      { engine: mockPrimaryEngine, useAsFallback: false },
      { engine: mockFallbackEngine, useAsFallback: true }
    ]);

    const result = await signature.extract('sig');
    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'No available engine for signature extraction'
    );
  });

  it('should return null when engine.extract throws', async () => {
    mockPrimaryEngine.isActive.mockReturnValue(true);
    mockPrimaryEngine.extract.mockRejectedValue(new Error('boom'));

    const signature = new Signature(mockLogger, [
      { engine: mockPrimaryEngine, useAsFallback: false }
    ]);

    const result = await signature.extract('sig');
    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed during extraction'),
      expect.any(Object)
    );
  });
});
