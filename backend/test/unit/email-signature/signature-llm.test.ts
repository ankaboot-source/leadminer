import { Logger } from 'winston';
import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach
} from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { SignatureLLM } from '../../../src/services/signature/llm';
import { IRateLimiter } from '../../../src/services/rate-limiter/RateLimiter';

import { LLMModelsList } from '../../../src/services/signature/llm/types';

describe('SignatureLLM', () => {
  let mockAxios: MockAdapter;
  let mockRateLimiter: jest.Mocked<IRateLimiter>;
  let mockLogger: jest.Mocked<Logger>;

  const apiKey = 'test-key';
  const models = LLMModelsList;

  const createInstance = () =>
    new SignatureLLM(mockRateLimiter, mockLogger, models, apiKey);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = new MockAdapter(axios);
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    mockRateLimiter = {
      throttleRequests: jest.fn((fn: any) => fn())
    } as unknown as jest.Mocked<IRateLimiter>;
  });

  afterEach(() => {
    mockAxios.restore();
  });

  describe('constructor', () => {
    it('should throw if API key is empty', () => {
      expect(
        () => new SignatureLLM(mockRateLimiter, mockLogger, models, '')
      ).toThrow('API key is required and cannot be empty.');
    });

    it('should throw if models is missing', () => {
      expect(
        () =>
          new SignatureLLM(
            mockRateLimiter,
            mockLogger,
            undefined as any,
            apiKey
          )
      ).toThrow('Models are required and cannot be null or undefined.');
    });
  });

  describe('isActive', () => {
    it('should return true initially', () => {
      const instance = createInstance();
      expect(instance.isActive()).toBe(true);
    });
  });

  describe('sendPrompt', () => {
    it('should return content on successful LLM call', async () => {
      const mockResponse = {
        choices: [{ message: { content: '{"@type":"Person","name":"John"}' } }]
      };

      mockAxios
        .onPost('https://openrouter.ai/api/v1/chat/completions')
        .reply(200, mockResponse);

      const instance = createInstance();
      const result = await instance.sendPrompt(
        'test@leadminer.io',
        'signature text'
      );
      expect(result).toBe('{"@type":"Person","name":"John"}');
    });

    it('should deactivate instance and throw on 503 error', async () => {
      mockAxios
        .onPost('https://openrouter.ai/api/v1/chat/completions')
        .reply(503, {
          error: { code: 503, message: 'Service Unavailable' }
        });

      const instance = createInstance();
      await expect(
        instance.sendPrompt('test@leadminer.io', 'sig')
      ).rejects.toThrow('Service Unavailable');
      expect(instance.isActive()).toBe(false);
    });

    it('should log and return null on unexpected exception', async () => {
      mockRateLimiter.throttleRequests.mockImplementation(() => {
        throw new Error('Throttle failed');
      });

      const instance = createInstance();
      const result = await instance.sendPrompt('test@leadminer.io', 'sig');
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('SignaturePromptLLM error'),
        expect.any(Object)
      );
    });
  });

  describe('extract', () => {
    it('should return null if LLM response is null', async () => {
      const instance = createInstance();
      jest.spyOn(instance, 'sendPrompt' as any).mockResolvedValue('null');
      const result = await instance.extract('test@leadminer.io', 'sig');
      expect(result).toBeNull();
    });

    it('should return null if parsed content is not a Person', async () => {
      const instance = createInstance();
      jest
        .spyOn(instance, 'sendPrompt' as any)
        .mockResolvedValue('{"@type":"Organization"}');
      const result = await instance.extract('test@leadminer.io', 'sig');
      expect(result).toBeNull();
    });

    it('should return cleaned PersonLD for valid response', async () => {
      const person = {
        telephone: ['+3222876211'],
        address: 'Tunisia'
      };

      mockAxios
        .onPost('https://openrouter.ai/api/v1/chat/completions')
        .reply(200, {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  '@type': 'Person',
                  telephone: ['+3222876211'],
                  address: 'Tunisia'
                })
              }
            }
          ]
        });
      const instance = createInstance();
      const result = await instance.extract(
        'test@leadminer.io',
        'John +32 2 287 62 11 Tunisia'
      );
      expect(result).toEqual(person);
    });

    it('should log error and return null on invalid JSON', async () => {
      const instance = createInstance();
      jest
        .spyOn(instance, 'sendPrompt' as any)
        .mockResolvedValue('INVALID_JSON');

      const result = await instance.extract('test@leadminer.io', 'sig');
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('SignatureExtractionLLM error'),
        expect.anything()
      );
    });
  });
});
