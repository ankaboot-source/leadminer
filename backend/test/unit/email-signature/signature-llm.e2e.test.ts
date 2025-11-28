import { describe, beforeAll, test, expect, jest } from '@jest/globals';
import { Logger } from 'winston';
import { SignatureLLM } from '../../../src/services/signature/llm';
import { TokenBucketRateLimiter } from '../../../src/services/rate-limiter/RateLimiter';
import {
  LLMModelsList,
  LLMModelType
} from '../../../src/services/signature/llm/types';

// TO ENABLE: RUN `export .env` IN TERMINAL
const apiKey = process.env.OPENROUTER_API_KEY;

const MODELS: string[] = LLMModelsList;

const TEST_CASES: Array<{
  name: string;
  input: string;
  expected: null | Record<string, unknown>;
}> = [
  {
    name: 'Anonymous - simple signature with telephone',
    input: `Best regards,
  Anonymous
  07 00 12 34 56`,
    expected: {
      address: undefined,
      jobTitle: undefined,
      sameAs: undefined,
      telephone: ['+33700123456'],
      worksFor: undefined
    }
  }
];

(apiKey ? describe : describe.skip)(
  'SignatureLLM E2E (multi-model + multi-case)',
  () => {
    let logger: jest.Mocked<Logger>;

    beforeAll(() => {
      if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

      logger = {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        log: jest.fn()
      } as unknown as jest.Mocked<Logger>;
    });

    if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

    /* eslint-disable @typescript-eslint/no-loop-func */
    for (const model of MODELS) {
      describe(`MODEL: ${model}`, () => {
        // eslint-disable @typescript-eslint/no-loop-func
        for (const tc of TEST_CASES) {
          test(
            tc.name,
            async () => {
              const rateLimiter = new TokenBucketRateLimiter(1, 100);
              const llm = new SignatureLLM(
                rateLimiter,
                logger,
                model as LLMModelType,
                apiKey
              );

              const result = await llm.extract(tc.input);

              expect(result).toEqual(tc.expected);
            },
            40_000 // 40 seconds per test
          );
        }
      });
    }
    /* eslint-enable @typescript-eslint/no-loop-func */
  }
);
