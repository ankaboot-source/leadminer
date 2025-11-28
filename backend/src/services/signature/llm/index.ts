import assert from 'assert';
import { Logger } from 'winston';
import axios, { AxiosError } from 'axios';
import {
  undefinedIfEmpty,
  undefinedIfFalsy
} from '../../../utils/helpers/validation';
import { IRateLimiter } from '../../rate-limiter/RateLimiter';
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
  system: `
    <system_prompt>
      You are an information extraction model. Your task is to convert the provided email signature into a structured JSON object following schema.org "Person".

      ### OBJECTIVE
      - RETURN STRUCTURED JSON WITH FIELDS EXPLICITLY PRESENT IN THE SIGNATURE
      - OMIT EVERYTHING NOT FULLY PRESENT — NO GUESSING OR INFERENCE
      - OUTPUT NOTHING IF SIGNATURE IS EMPTY OR INVALID

      ### OUTPUT RULES
      - ALWAYS INCLUDE "@type": "Person"  
      - "name": REQUIRED — IF MISSING, RETURN NOTHING.
      - "telephone": EXTRACT AND CONVERT INTO E164 VALID FORMAT (e.g +13105550139).
      - "sameAs": EXTRACT SOCIAL OR WEBSITE URLS; ADD 'https://' IF '://' IS MISSING.  
      - "address": EXTRACT COMPLETE ADDRESS LOCATION IF COUNTRY IS PRESENT, OTHERWISE SKIP.
      - "worksFor": EXTRACT VALID COMPANY OR ORGANIZATION NAME IF IT'S EXPLICITLY WRITTEN.
      - "jobTitle": EXTRACT IF IT'S CLEARLY STATED (e.g., “Manager”, “CTO”).  
      - PRESERVE ORIGINAL SPELLING & CAPITALIZATION FOR ALL FIELDS.

      ### FIELDS
      - REQUIRED: "name"
      - OPTIONAL:  
        - "jobTitle" : string 
        - "worksFor" : string 
        - "email" : string 
        - "telephone": string[]  
        - "address": string
        - "sameAs": string[]  

      ### CHAIN OF THOUGHT
      1. READ the signature
      2. VALIDATE it's a real structured signature
      3. EXTRACT ONLY EXPLICITLY WRITTEN FIELDS
      4. FORMAT phones and social URLs correctly
      5. BUILD JSON using schema.org "Person"
      6. RETURN JSON OR NOTHING — NEVER GUESS

      ### WHAT NOT TO DO
      - NEVER GUESS OR HALLUCINATE FIELDS  
      - NEVER INFER PARTIAL OR IMPLIED INFORMATION  
      - NEVER ADD COMMENTS, NOTES, OR FORMATTING  
      - NEVER INCLUDE INVALID OR INCOMPLETE FIELDS  

      ### GOOD EXAMPLE

      **Input:**
      Jhon Doe
      CTO
      Leadminer Systems
      jhon.doe@leadminer.io
      +1 411 553 1139
      123 Main St, Los Angeles, USA
      LinkedIn: https://linkedin.com/in/jhon
      Twitter: https://x.com/jhon_cto

      **Output:**
      {
        "@type": "Person",
        "name": "Jhon Doe",
        "jobTitle": "CTO",
        "worksFor": "Leadminer Systems",
        "email": "jhon.doe@leadminer.io",
        "telephone": ["+13105550139"],
        "address": "123 Main St, Los Angeles, USA",
        "sameAs": [
          "https://linkedin.com/in/jhon",
          "https://x.com/jhon_cto"
        ]
      }
    </system_prompt>
    `,
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
        required: ['@type'], // , 'name'
        additionalProperties: false
      }
    }
  },
  buildUserPrompt: (signature: string) =>
    `Here a signature extracted from an email address. return null if not a real signature:\n\n${signature}`
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
    private readonly model: LLMModelType,
    private readonly apiKey: string
  ) {
    assert(
      apiKey && apiKey.trim() !== '',
      'API key is required and cannot be empty.'
    );
    assert(model, 'Model is required and cannot be null or undefined.');
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

  private body(signature: string) {
    return JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: SignaturePrompt.system },
        {
          role: 'user',
          content: SignaturePrompt.buildUserPrompt(signature)
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

  async sendPrompt(signature: string): Promise<string | null> {
    try {
      const response = await this.rateLimiter.throttleRequests(() =>
        axios<OpenRouterResponse>(this.LLM_ENDPOINT, {
          method: 'POST',
          headers: this.headers(),
          data: this.body(signature)
        })
      );
      const { data } = response;
      return (data as OpenRouterResponse).choices?.[0]?.message?.content;
    } catch (err) {
      this.logger.error(
        `SignatureExtractionLLM error: ${(err as Error).message}`,
        { error: err }
      );
      if (
        err instanceof AxiosError &&
        err?.response?.data &&
        'error' in err.response.data
      ) {
        this.handleResponseError((err.response?.data as OpenRouterError).error);
      }

      return null;
    }
  }

  cleanOutput(signature: string, person: PersonLD): PersonLD | null {
    return removeFalsePositives(
      {
        // name: undefinedIfFalsy(parseString(person.name)),
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

  async extract(signature: string): Promise<PersonLD | null> {
    try {
      const content = await this.sendPrompt(signature);

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
