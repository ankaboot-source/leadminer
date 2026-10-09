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
import {
  SignatureLLM,
  SignaturePrompt
} from '../../../src/services/signature/llm';
import { IRateLimiter } from '../../../src/services/rate-limiter';

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
      error: jest.fn(),
      warn: jest.fn()
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

  describe('request body', () => {
    const bodyOf = (instance: SignatureLLM) =>
      JSON.parse(
        (instance as unknown as { body(e: string, s: string): string }).body(
          'test@leadminer.io',
          'sig'
        )
      );

    it('should disable reasoning so thinking cannot exhaust max_tokens', () => {
      // Regression guard: with reasoning on, reasoning models burn the whole
      // 1000-token budget and return empty content, which extract() drops.
      expect(bodyOf(createInstance()).reasoning).toEqual({ enabled: false });
    });

    it('should send at most the first three models as the fallback chain', () => {
      const instance = new SignatureLLM(
        mockRateLimiter,
        mockLogger,
        LLMModelsList as never,
        apiKey
      );
      const body = bodyOf(instance);
      expect(body.models).toEqual(LLMModelsList.slice(0, 3));
      expect(body.models).toHaveLength(3);
    });

    it('should not request Zero Data Retention routing by default', () => {
      expect(bodyOf(createInstance()).provider).toBeUndefined();
    });

    it('should request Zero Data Retention routing when enabled', () => {
      const instance = new SignatureLLM(
        mockRateLimiter,
        mockLogger,
        LLMModelsList as never,
        apiKey,
        true
      );
      expect(bodyOf(instance).provider).toEqual({ zdr: true });
    });

    it('should keep the strict json_schema response format', () => {
      const body = bodyOf(createInstance());
      expect(body.response_format.type).toBe('json_schema');
      expect(body.response_format.json_schema.strict).toBe(true);
      expect(body.response_format.json_schema.schema.required).toContain(
        '@type'
      );
    });

    it('should make every field nullable so declining is expressible', () => {
      // Under strict mode a model must emit every key in `required`, so a
      // non-nullable string obliges it to invent a value for absent data.
      // Measured on 80 real signatures: 0.681 accuracy non-nullable, 0.776
      // nullable. Telling it to return null WITHOUT this change was worse than
      // the baseline (0.655), because the instruction contradicted the schema.
      const props =
        bodyOf(createInstance()).response_format.json_schema.schema.properties;
      for (const field of [
        'name',
        'jobTitle',
        'worksFor',
        'email',
        'telephone',
        'address',
        'sameAs'
      ]) {
        expect(props[field].type).toContain('null');
      }
    });

    it('should tell the model that null is a valid answer', () => {
      // The instruction and the schema have to agree, or the model is being
      // told to do something it is not permitted to do.
      const prompt = SignaturePrompt.buildUserPrompt(
        'someone@example.com',
        'Jane Doe'
      );
      expect(prompt).toMatch(/null/i);
      expect(prompt).toMatch(/set every field to null/i);
    });
  });

  describe('declining a non-signature', () => {
    // The model can now say "this is not a signature" because every field is
    // nullable. These lock in that the answer survives the whole pipeline and
    // reaches the caller as "no signature", rather than as an empty Person or a
    // field invented to fill the slot.
    const allNull = {
      '@type': 'Person',
      name: null,
      jobTitle: null,
      worksFor: null,
      email: null,
      telephone: null,
      address: null,
      sameAs: null
    };

    it.each([
      ['a device footer', 'Sent from Mail for Windows 10'],
      [
        'an unsubscribe footer',
        'Click here to unsubscribe\nYou received this message because you are subscribed.'
      ],
      [
        'an Arabic quote header',
        "في يوم 24 أغسطس، 2020 11:15 ص، كتب Sana'a Rohy <eradahalfakeh@gmail.com>:"
      ]
    ])('should return null for %s', async (_label, signature) => {
      mockAxios
        .onPost('https://openrouter.ai/api/v1/chat/completions')
        .reply(200, {
          choices: [{ message: { content: JSON.stringify(allNull) } }]
        });

      await expect(
        createInstance().extract('test@leadminer.io', signature)
      ).resolves.toBeNull();
    });

    it('should still extract a real signature when the model answers', async () => {
      mockAxios
        .onPost('https://openrouter.ai/api/v1/chat/completions')
        .reply(200, {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  '@type': 'Person',
                  name: 'Gary Waxman',
                  jobTitle: null,
                  worksFor: null,
                  email: null,
                  telephone: null,
                  address: null,
                  sameAs: null
                })
              }
            }
          ]
        });

      await expect(
        createInstance().extract(
          'gary.waxman@enron.com',
          'Gary Waxman\nEnron Broadband Services'
        )
      ).resolves.toEqual({ name: 'Gary Waxman' });
    });

    it('should treat an empty string the same as null', async () => {
      // Before this change the model could only decline by returning "", which
      // is indistinguishable from a real empty value downstream.
      mockAxios
        .onPost('https://openrouter.ai/api/v1/chat/completions')
        .reply(200, {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  '@type': 'Person',
                  name: '',
                  jobTitle: '',
                  worksFor: '',
                  email: '',
                  telephone: [],
                  address: '',
                  sameAs: []
                })
              }
            }
          ]
        });

      await expect(
        createInstance().extract('test@leadminer.io', 'Sent from my iPhone')
      ).resolves.toBeNull();
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

    describe('no ZDR endpoint available', () => {
      // Captured from a live OpenRouter response for a ':free' model sent with
      // provider.zdr — note it is a 404 from the routing funnel, not a 4xx
      // transport failure, so the 402/502/503 branch never sees it.
      const zdrRoutingFailure = {
        code: 404,
        message:
          'No endpoints found matching your data policy (Zero data retention). Configure: https://openrouter.ai/settings/privacy',
        metadata: {
          routing_funnel: [{ step: 'Initial Endpoints', endpoint_count: 1 }],
          failed_routing_step: 'Filter by Data Policy'
        }
      };

      const createZdrInstance = () =>
        new SignatureLLM(
          mockRateLimiter,
          mockLogger,
          LLMModelsList as never,
          apiKey,
          true
        );

      const replyWithZdrFailure = (payload: unknown) =>
        mockAxios
          .onPost('https://openrouter.ai/api/v1/chat/completions')
          .reply(404, { error: payload });

      it('should keep the engine active, since OpenRouter answers intermittently', async () => {
        // Measured against live OpenRouter: 12/12 ZDR requests served, with the
        // occasional 404. Disabling here would permanently downgrade extraction
        // quality over a momentary blip.
        replyWithZdrFailure(zdrRoutingFailure);

        const instance = createZdrInstance();
        await expect(
          instance.sendPrompt('test@leadminer.io', 'sig')
        ).rejects.toThrow('No endpoints found matching your data policy');
        expect(instance.isActive()).toBe(true);
      });

      it('should still stay active across repeated failures', async () => {
        replyWithZdrFailure(zdrRoutingFailure);

        const instance = createZdrInstance();
        const attempts = [1, 2, 3, 4, 5].reduce(
          (chain) =>
            chain.then(() =>
              expect(
                instance.sendPrompt('test@leadminer.io', 'sig')
              ).rejects.toThrow()
            ),
          Promise.resolve()
        );
        await attempts;
        expect(instance.isActive()).toBe(true);
      });

      it('should warn that the signature was not extracted', async () => {
        replyWithZdrFailure(zdrRoutingFailure);

        await expect(
          createZdrInstance().sendPrompt('test@leadminer.io', 'sig')
        ).rejects.toThrow();

        const warning = mockLogger.warn.mock.calls.flat().join(' ');
        expect(warning).toContain('No ZDR endpoint available');
        expect(warning).toContain('was not extracted');
      });

      it('should warn with the cause and both remedies', async () => {
        replyWithZdrFailure(zdrRoutingFailure);

        await expect(
          createZdrInstance().sendPrompt('test@leadminer.io', 'sig')
        ).rejects.toThrow();

        const warning = mockLogger.warn.mock.calls.flat().join(' ');
        expect(warning).toContain('SIGNATURE_LLM_REQUIRE_ZDR=false');
        expect(warning).toContain('ZDR support');
      });

      it('should detect it from the message when metadata is absent', async () => {
        replyWithZdrFailure({
          code: 404,
          message: 'No endpoints found matching your data policy (ZDR)'
        });

        await expect(
          createZdrInstance().sendPrompt('test@leadminer.io', 'sig')
        ).rejects.toThrow();

        expect(mockLogger.warn.mock.calls.flat().join(' ')).toContain(
          'No ZDR endpoint available'
        );
      });

      it('should not warn for a 404 that is unrelated to ZDR', async () => {
        // "model not found" also 404s. Misreading it as a data-policy problem
        // would cry wolf on an unrelated failure.
        replyWithZdrFailure({
          code: 404,
          message: 'No endpoints found for model',
          metadata: { failed_routing_step: 'Resolve Model' }
        });

        await expect(
          createZdrInstance().sendPrompt('test@leadminer.io', 'sig')
        ).rejects.toThrow();

        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should not warn when the flag is off', async () => {
        // Without the flag no data policy was requested, so this response
        // cannot be the cause of a ZDR rejection.
        replyWithZdrFailure(zdrRoutingFailure);

        await expect(
          createInstance().sendPrompt('test@leadminer.io', 'sig')
        ).rejects.toThrow();

        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should never retry the request without ZDR', async () => {
        // Silently dropping provider.zdr would send personal data to a
        // retaining endpoint — the one outcome the flag exists to prevent.
        replyWithZdrFailure(zdrRoutingFailure);

        await expect(
          createZdrInstance().sendPrompt('test@leadminer.io', 'sig')
        ).rejects.toThrow();

        expect(mockAxios.history.post).toHaveLength(1);
        const sent = JSON.parse(mockAxios.history.post[0].data);
        expect(sent.provider).toEqual({ zdr: true });
      });

      it('should let extract() return null for an unextracted signature', async () => {
        // Nothing unverified may reach the contact record.
        replyWithZdrFailure(zdrRoutingFailure);

        const result = await createZdrInstance().extract(
          'test@leadminer.io',
          'Jane Doe\nHead of Widgets'
        );
        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();
      });
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
      jest.spyOn(instance, 'sendPrompt').mockResolvedValue('null');
      const result = await instance.extract('test@leadminer.io', 'sig');
      expect(result).toBeNull();
    });

    it('should return null if parsed content is not a Person', async () => {
      const instance = createInstance();
      jest
        .spyOn(instance, 'sendPrompt')
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
      jest.spyOn(instance, 'sendPrompt').mockResolvedValue('INVALID_JSON');

      const result = await instance.extract('test@leadminer.io', 'sig');
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('SignatureExtractionLLM error'),
        expect.objectContaining({
          error: expect.objectContaining({ name: expect.any(String) })
        })
      );
    });
  });
});
