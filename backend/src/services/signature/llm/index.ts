import assert from 'assert';
import { Logger } from 'winston';
import axios, { AxiosError } from 'axios';
import {
  undefinedIfEmpty,
  undefinedIfFalsy
} from '../../../utils/helpers/validation';
import { IRateLimiter } from '../../rate-limiter';
import { ExtractSignature, PersonLD } from '../types';
import {
  parseLocationString,
  parseString,
  parseStringArray,
  removeFalsePositives,
  validatePhones,
  validateUrls
} from './output-checkers';
import { LLMModelType } from './types';

export const SignaturePrompt = {
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'parsed_email_signature',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          '@type': {
            type: 'string',
            const: 'Person',
            description:
              'Must always be "Person" as per schema.org type definition'
          },
          name: {
            type: 'string'
          },
          jobTitle: {
            type: 'string'
          },
          worksFor: {
            type: 'string'
          },
          email: {
            type: 'string'
          },
          telephone: {
            type: 'array',
            items: {
              type: 'string',
              pattern: '\\+\\d{7,15}'
            }
          },
          address: {
            type: 'string'
          },
          sameAs: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        },
        required: [
          '@type',
          'name',
          'jobTitle',
          'worksFor',
          'email',
          'telephone',
          'address',
          'sameAs'
        ],
        additionalProperties: false
      }
    }
  },
  buildUserPrompt: (email: string, signature: string) =>
    `
    You are a deterministic structured-data extraction engine specialized in parsing email signatures.
    Your output is consumed by financial and enterprise systems. Accuracy is mandatory, and guessing is forbidden.

    ### OUTPUT FORMAT (STRICT)
    - Return ONLY a JSON object matching the provided JSON schema.
    - Do NOT add fields not present in the schema.
    - Do NOT return text outside JSON.

    ### EXTRACTION RULES (STRICT)
    - **Crucial:** Include ONLY fields that successfully conform to their specific rules and appear explicitly in the signature.
    - NEVER infer, guess, or rewrite missing information.


    ### FIELD RULES (STRICT & UNAMBIGUOUS)
    **@type**
    - Always "Person".

    **name**
    - First and last name.
    - Preserve case sensitivity.
    - Reject usernames, emails, initials, handles, single-word names.

    **email**
    - Must contain @ and a valid domain + TLD.

    **telephone**
    - Normalize to E.164 format (e.g., +CCNNNNNNNNN, where CC is the country code). 
    - Remove all spaces, dots, hyphens, parentheses, and text descriptors (e.g., "Tel:", "Mobile:"). 

    **jobTitle**
    - Accept: only the explicit, formal position.
    - Strictly Exclude: Locational/Qualifying Phrases, text following prepositions (de, du, au, en).
    - reject: Slogans, descriptions, certifications (e.g., PhD, MBA).

    **worksFor**
    - The name of the company, organization, or government body.
    - Strictly Reject: Divisions, departments (e.g., "Sales Division"), addresses, cities, names of publications, or titles that are not formal organization names.

    **address**
    - Can be extracted from one line or multiple lines.
    - Remove trailing text, spaces, slashes, periods (dots), or punctuation.

    **sameAs**
    - Extract URLs pointing to profiles or websites.
    - If scheme missing → prepend https://
    - URL must contain a valid domain + TLD.
    - Remove any trailing spaces, slashes, periods (dots), or punctuation.

    ### OUTPUT
    Return ONLY the JSON defined by the JSON schema, no comments or explanation.


    Given the following signature text from an email address with the domain ${email.split('@').pop}, extract explicitly present fields into the JSON format.

    Signature:
    ---
    ${signature}
    ---
  `
};

type OpenRouterError = {
  error: {
    code: number;
    message: string;
    metadata?: Record<string, unknown>;
  };
};

type OpenRouterResponse = {
  id: string;
  choices: Array<{
    message: {
      role: 'assistant' | 'user' | 'system' | 'tool';
      content: string;
      refusal: string;
    };
    finish_reason: string;
    index: number;
  }>;
  provider: string;
  model: string;
  object: string;
  created: number;
  system_fingerprint: Record<string, unknown>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export class SignatureLLM implements ExtractSignature {
  LLM_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  private active = true;

  constructor(
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: Logger,
    private readonly models: LLMModelType[],
    private readonly apiKey: string
  ) {
    assert(
      apiKey && apiKey.trim() !== '',
      'API key is required and cannot be empty.'
    );
    assert(
      models?.length,
      'Models are required and cannot be null or undefined.'
    );
  }

  isActive(): boolean {
    return this.active;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  private body(email: string, signature: string) {
    return JSON.stringify({
      models: this.models.slice(0, 3),
      messages: [
        {
          role: 'user',
          content: SignaturePrompt.buildUserPrompt(email, signature)
        }
      ],
      response_format: SignaturePrompt.response_format
    });
  }

  private handleResponseError(error: OpenRouterError['error']) {
    if ([402, 502, 503].includes(error.code)) {
      this.active = false;
    }
    throw new Error(error.message);
  }

  async sendPrompt(email: string, signature: string): Promise<string | null> {
    try {
      const response = await this.rateLimiter.throttleRequests(() =>
        axios<OpenRouterResponse>(this.LLM_ENDPOINT, {
          method: 'POST',
          headers: this.headers(),
          data: this.body(email, signature)
        })
      );
      const { data } = response;
      return (data as OpenRouterResponse).choices?.[0]?.message?.content;
    } catch (err) {
      let error: Error | OpenRouterError['error'] = err as Error;
      let openRouterErrorData: OpenRouterError['error'] | null = null;

      if (
        err instanceof AxiosError &&
        err?.response?.data &&
        'error' in err.response.data
      ) {
        openRouterErrorData = (err.response?.data as OpenRouterError).error;
        error = openRouterErrorData;
      }

      this.logger.error(`SignaturePromptLLM error: ${error.message}`, {
        error
      });

      if (openRouterErrorData) {
        this.handleResponseError(openRouterErrorData);
      }
      return null;
    }
  }

  cleanOutput(signature: string, person: PersonLD): PersonLD | null {
    return removeFalsePositives(
      {
        name: undefinedIfFalsy(parseString(person.name)),
        jobTitle: undefinedIfFalsy(parseString(person.jobTitle)),
        worksFor: undefinedIfFalsy(parseString(person.worksFor)),
        address: undefinedIfFalsy(parseLocationString(person.address)),
        telephone: undefinedIfEmpty(
          validatePhones(signature, parseStringArray(person.telephone) ?? [])
        ),
        sameAs: undefinedIfEmpty(
          validateUrls(signature, parseStringArray(person.sameAs) ?? [])
        )
      },
      signature,
      this.logger
    );
  }

  async extract(email: string, signature: string): Promise<PersonLD | null> {
    try {
      const content = await this.sendPrompt(email, signature);

      this.logger.debug(`extract signature content: ${content}`);

      if (!content || content.toLowerCase() === 'null') return null;

      const parsed = JSON.parse(content);
      const person = Array.isArray(parsed) ? parsed[0] : parsed;

      if (!person || person['@type'] !== 'Person') return null;

      return this.cleanOutput(signature, person);
    } catch (err) {
      this.logger.error(
        `SignatureExtractionLLM error: ${(err as Error).message}`,
        err
      );
      return null;
    }
  }
}
