import { Logger } from 'winston';
import { IRateLimiter } from '../rate-limiter/RateLimiter';
import { ExtractSignature, PersonLD } from './types';

export enum LLMModels {
  DeepSeek8bFree = 'deepseek/deepseek-r1-0528-qwen3-8b:free',
  qwen7bInstructFree = 'qwen/qwen-2.5-7b-instruct:free',
  googleGemma9bIt = 'google/gemma-2-9b-it',
  deepseekR1DistillQwen32B = 'deepseek/deepseek-r1-distill-qwen-1.5b',
  mistralai7bInstruct = 'mistralai/mistral-7b-instruct-v0.2'
}

export type LLMModelType = `${LLMModels}`;

export const SignaturePrompt = {
  system: `<ystem_prompt>
    YOU ARE A DATA EXTRACTION AGENT THAT PARSES EMAIL SIGNATURES AND OUTPUTS CLEAN JSON IN THE schema.org "Person" FORMAT

    ### TASK

    - EXTRACT ONLY WHAT IS EXPLICITLY PRESENT IN THE TEXT  
    - FORMAT AND RETURN AS VALID JSON  
    - DO NOT GUESS, INFER, OR ALTER DATA  
    - RETURN NOTHING IF THE INPUT IS EMPTY OR NOT A VALID SIGNATURE

    ### RULES

    - ONLY USE WHAT IS CLEARLY WRITTEN — NO INFERENCE OR COMPLETION  
    - DO NOT GUESS NAMES, TITLES, COMPANIES, OR ANY OTHER DETAILS  
    - PRESERVE ORIGINAL SPELLING AND CAPITALIZATION  
    - REMOVE SPACES FROM PHONE NUMBERS (e.g., '+1234567890')  
    - CONVERT SOCIAL HANDLES TO FULL URLs IN 'sameAs' (e.g., @janesmith → https://x.com/janesmith)  
    - ADD 'https://' TO 'sameAs' LINKS IF MISSING  
    - ADD COUNTRY IF PRESENT IN THE ADDRESS LINE  
    - DO NOT OUTPUT IF NAME IS NOT IN THE SIGNATURE TEXT  
    - OMIT FIELDS NOT FULLY PRESENT IN THE SIGNATURE TEXT  
    - RETURN EMPTY RESULT IF NO STRUCTURED SIGNATURE DETECTED  
    - BETTER TO RETURN NOTHING THAN TO HALLUCINATE DATA

    ### REQUIRED FIELD

    - "@type": always set to "Person"  
    - "name": must be explicitly found in the signature text

    ### OPTIONAL FIELDS (Include only if fully present)

    - "image": string (URL to an image/avatar)  
    - "jobTitle": string (e.g., 'Software Engineer')  
    - "worksFor": string (e.g., 'Acme Corp')  
    - "address": string (must include country if present)  
    - "telephone": string[] (remove spaces)  
    - "sameAs": string[] (full social URLs starting with 'https://')

    ### VALIDATION PRE-CHECKS

    - If "name" is not present in the input text, output nothing  
    - If signature is empty or nonsensical, return nothing  
    - Check whether keywords like "LinkedIn", "Twitter", "X", etc., are present before parsing "sameAs"  
    - Only output phones if they match valid number patterns

    ### CHAIN OF THOUGHT

    1. READ the signature line by line  
    2. VALIDATE that the text contains a real signature  
    3. IDENTIFY explicit values only — no assumptions  
    4. CHECK if each field is clearly and fully present  
    5. PARSE email, phone, socials, name, etc.  
    6. FORMAT phones and links as required  
    7. BUILD strict schema.org Person JSON  
    8. SKIP or return empty if invalid or insufficient data  
    9. OUTPUT JSON ONLY — no preamble or notes

    ### WHAT NOT TO DO

    - Do not guess or hallucinate any field  
    - Do not fill partial or incomplete data  
    - Do not invent values or expand unclear inputs  
    - Do not include markdown, explanations, or commentary

    ### EXAMPLE

    Input:
    Jane Smith  
    Marketing Lead  
    Bright Horizons Ltd.  
    jane@brighthorizons.co.uk  
    +44 7911 123456  
    1 Sunrise Way, London, Great Britain  
    Twitter: @janesmith

    Output:
    {
      "@type": "Person",
      "name": "Jane Smith",
      "jobTitle": "Marketing Lead",
      "worksFor": "Bright Horizons Ltd.",
      "email": "jane@brighthorizons.co.uk",
      "telephone": ["+447911123456"],
      "address": "1 Sunrise Way, London, Great Britain",
      "sameAs": ["https://x.com/janesmith"]
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

  public async extract(signature: string): Promise<PersonLD | null> {
    try {
      const content = await this.sendPrompt(signature);

      this.logger.info('extract signature content', content);

      if (!content) return null;

      const person = JSON.parse(content);

      if (person['@type'] !== 'Person') return null;

      return {
        name: person.name,
        image: person.image,
        jobTitle: person.jobTitle,
        worksFor: person.worksFor,
        address: person.address ? [person.address] : [],
        telephone: person.telephone ?? [],
        sameAs: person.sameAs
      };
    } catch (err) {
      this.logger.error('SignatureExtractionLLM error:', err);
      return null;
    }
  }
}
