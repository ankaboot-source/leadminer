import { Logger } from 'winston';
import assert from 'assert';
import { IRateLimiter } from '../../rate-limiter/RateLimiter';
import { ExtractSignature, PersonLD } from '../types';
import {
  undefinedIfFalsy,
  undefinedIfEmpty
} from '../../../utils/helpers/validation';
import {
  parseString,
  parseStringArray,
  removeFalsePositives,
  validatePhones,
  validateUrls
} from './output-checkers';

export enum LLMModels {
  qwenFree = 'qwen/qwen-2.5-7b-instruct:free',
  deepseekFree = 'deepseek/deepseek-r1-0528-qwen3-8b:free',
  cohere = 'cohere/command-r-08-2024',
  cohere7b = 'cohere/command-r7b-12-2024',
  meta = 'meta-llama/llama-3.1-8b-instruct',
  google = 'google/gemma-2-9b-it'
}

export type LLMModelType = `${LLMModels}`;

export const SignaturePrompt = {
  system: `
    <system_prompt>
      YOU ARE A DATA EXTRACTION AGENT TRAINED TO PARSE EMAIL SIGNATURES INTO STRICT, CLEAN JSON USING THE schema.org "Person" FORMAT

      ### OBJECTIVE

      - RETURN STRUCTURED JSON WITH FIELDS EXPLICITLY PRESENT IN THE SIGNATURE
      - OMIT EVERYTHING NOT FULLY PRESENT — NO GUESSING OR INFERENCE
      - OUTPUT NOTHING IF SIGNATURE IS EMPTY OR INVALID

      ### OUTPUT RULES

      - ALWAYS INCLUDE "@type": "Person"  
      - "name" IS REQUIRED — IF MISSING, RETURN NOTHING  
      - "telephone": CONVERT INTO E164 VALID FORMAT (e.g +13105550139) 
      - "sameAs": ARRAY OF VALID PRESENT SOCIAL URLS (e.g https://linkedin.com/in/jhondoe); ADD 'https://' IF MISSING  
      - "address": INCLUDE COUNTRY IF PRESENT  
      - PRESERVE ORIGINAL SPELLING & CAPITALIZATION

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
      +1 310 555 0139
      123 Main St, Los Angeles, USA
      LinkedIn: https://linkedin.com/in/jhon
      Twitter: https://x.com/jhon_cto

      Linkedin1: @jhondoe
      Twitter1: @jhondoe_jh
      
      **Output:**
      {
        "@type": "Person",
        "name": "Sarah Connor",
        "jobTitle": "CTO",
        "worksFor": "Skynet Systems",
        "email": "s.connor@skynet.ai",
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
          // name: {
          //   type: 'string',
          //   description:
          //     'Full name exactly as written in the signature, preserving original spelling and capitalization'
          // },
          jobTitle: {
            type: 'string',
            description: 'Job title or position, only if explicitly stated'
          },
          worksFor: {
            type: 'string',
            description:
              'Organization or company name, only if explicitly present'
          },
          email: {
            type: 'string',
            description: 'Email address, exactly as written in the signature'
          },
          telephone: {
            type: 'array',
            items: {
              type: 'string',
              pattern: '\\+\\d{7,15}'
            },
            description:
              'List of phone numbers in E.164 format (e.g., +13105550139); only include if explicitly written'
          },
          address: {
            type: 'string',
            description:
              'Full address including country, only if fully written in the signature'
          },
          sameAs: {
            type: 'array',
            items: {
              type: 'string'
            },
            description:
              'Array of social profile URLs (e.g., LinkedIn, Twitter); add https:// prefix if missing'
          }
        },
        required: ['@type'], // , 'name'
        additionalProperties: false
      }
    }
  },
  buildUserPrompt: (signature: string) =>
    `RETURN NULL IF NOT A REAL PERSON SIGNATURE:\n${signature}`
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
    logprobs: Record<string, unknown>;
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

  private async sendPrompt(signature: string): Promise<string | null> {
    try {
      const response = await this.rateLimiter.throttleRequests(() =>
        fetch(this.LLM_ENDPOINT, {
          method: 'POST',
          headers: this.headers(),
          body: this.body(signature)
        })
      );

      const data = await response.json();

      if ('error' in data)
        this.handleResponseError((data as OpenRouterError).error);

      return (data as OpenRouterResponse).choices?.[0]?.message?.content;
    } catch (err) {
      this.logger.error('SignatureExtractionLLM error:', { error: err });
      return null;
    }
  }

  private cleanOutput(signature: string, person: PersonLD): PersonLD | null {
    return removeFalsePositives(
      {
        // name: undefinedIfFalsy(parseString(person.name)),
        jobTitle: undefinedIfFalsy(parseString(person.jobTitle)),
        worksFor: undefinedIfFalsy(parseString(person.worksFor)),
        address: undefinedIfEmpty(parseStringArray(person.address) ?? []),
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

  public async extract(signature: string): Promise<PersonLD | null> {
    try {
      const content = await this.sendPrompt(signature);

      this.logger.debug(`extract signature content: ${content}`);

      if (!content) return null;

      const parsed = JSON.parse(content);
      const person = Array.isArray(parsed) ? parsed[0] : parsed;

      if (person['@type'] !== 'Person') return null;

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
