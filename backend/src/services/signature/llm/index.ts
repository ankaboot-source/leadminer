import { Logger } from 'winston';
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
  DeepSeek8bFree = 'deepseek/deepseek-r1-0528-qwen3-8b:free',
  qwen7bInstructFree = 'qwen/qwen-2.5-7b-instruct:free',
  googleGemma9bIt = 'google/gemma-2-9b-it',
  deepseekR1DistillQwen32B = 'deepseek/deepseek-r1-distill-qwen-1.5b',
  mistralai7bInstruct = 'mistralai/mistral-7b-instruct-v0.2'
}

export type LLMModelType = `${LLMModels}`;

export const SignaturePrompt = {
  system: `<system_prompt>
    YOU ARE A DATA EXTRACTION AGENT TRAINED TO PARSE EMAIL SIGNATURES INTO STRICT, CLEAN JSON USING THE schema.org "Person" FORMAT

    ### OBJECTIVE

    - RETURN STRUCTURED JSON WITH FIELDS EXPLICITLY PRESENT IN THE SIGNATURE
    - OMIT EVERYTHING NOT FULLY PRESENT — NO GUESSING OR INFERENCE
    - OUTPUT NOTHING IF SIGNATURE IS EMPTY OR INVALID

    ### OUTPUT RULES

    - ALWAYS INCLUDE "@type": "Person"  
    - "name" IS REQUIRED — IF MISSING, RETURN NOTHING  
    - "telephone": REMOVE ALL SPACES  
    - "sameAs": CONVERT HANDLES (e.g., @user → https://x.com/user); ADD 'https://' IF MISSING  
    - "address": INCLUDE COUNTRY IF PRESENT  
    - "image": Valid URL TO AN IMAGE OR AVATAR 
    - PRESERVE ORIGINAL SPELLING & CAPITALIZATION

    ### FIELDS

    - REQUIRED: "name"
    - OPTIONAL:  
      - "jobTitle" : string 
      - "worksFor" : string 
      - "email" : string 
      - "telephone": string[]  
      - "address": string 
      - "image" : string 
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
    - NEVER OUTPUT ANYTHING IF "name" IS MISSING  
    - NEVER INCLUDE INVALID OR INCOMPLETE FIELDS  

    ### GOOD EXAMPLE

    **Input:**
    Sarah Connor
    CTO
    Skynet Systems
    s.connor@skynet.ai
    +1 310 555 0139
    123 Main St, Los Angeles, USA
    LinkedIn: linkedin.com/in/sconnor
    Twitter: @terminator_cto
    
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
        "https://linkedin.com/in/sconnor",
        "https://x.com/terminator_cto"
      ]
    }
  </system_prompt>
    `,
  response_format: {
    type: 'json_object'
  },

  buildUserPrompt: (signature: string) => `${signature}`
};

export class SignatureLLM implements ExtractSignature {
  LLM_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: Logger,
    private readonly model: LLMModelType,
    private readonly apiKey: string
  ) {}

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
      const error = data?.error?.message;
      if (error) throw new Error(error);
      return data.choices?.[0]?.message?.content;
    } catch (err) {
      this.logger.error('SignatureExtractionLLM error:', err);
      return null;
    }
  }

  private cleanOutput(signature: string, person: PersonLD): PersonLD | null {
    return removeFalsePositives(
      {
        name: undefinedIfFalsy(parseString(person.name)),
        image: undefinedIfFalsy(parseString(person.image)),
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

      this.logger.info('extract signature content', content);

      if (!content) return null;

      const person = JSON.parse(content);

      if (person['@type'] !== 'Person') return null;

      return this.cleanOutput(signature, person);
    } catch (err) {
      this.logger.error('SignatureExtractionLLM error:', err);
      return null;
    }
  }
}
