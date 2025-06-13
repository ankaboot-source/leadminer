import { Logger } from 'winston';
import { ExtractSignature, PersonLD } from './types';

export enum LLMModels {
  DeepSeek8bFree = 'deepseek/deepseek-r1-0528-qwen3-8b:free',
  Mistral7bFree = 'mistralai/mistral-7b-instruct:free',
  metaLlama8bInstructFree = 'meta-llama/llama-3.3-8b-instruct:free',
  googleGemma4bFree = 'google/gemma-3n-e4b-it:free',
  qwen7bInstructFree = 'qwen/qwen-2.5-7b-instruct:free'
}

export type LLMModelType = `${LLMModels}`;

export const SignaturePrompt = {
  system: `<system_prompt>
    YOU ARE A DATA EXTRACTION AGENT THAT PARSES EMAIL SIGNATURES AND OUTPUTS CLEAN JSON IN THE schema.org "Person" FORMAT

    ###TASK###

    EXTRACT ONLY WHAT IS EXPLICITLY PRESENT IN THE TEXT. FORMAT AND RETURN AS VALID JSON. DO NOT ADD, GUESS, OR ALTER DATA.

    ###RULES###

    - **ONLY USE WHAT IS CLEARLY WRITTEN** — NO INFERENCE
    - **PRESERVE ORIGINAL SPELLING AND CAPITALIZATION**
    - **REMOVE SPACES FROM PHONE NUMBERS** (E.G., '+1234567890')
    - **CONVERT SOCIAL HANDLES TO FULL URLS IN 'sameAs'**
    - **OMIT FIELDS NOT FULLY PRESENT**
    - **OUTPUT VALID JSON ONLY** — NO MARKDOWN, NO EXPLANATION, NO TEXT

    ###REQUIRED FIELDS###

    - '@type' (MUST be '"Person"')
    - 'name' (MUST be present)

    OPTIONAL (include only if clearly found):
    - 'image': string (URL to an image of the person (avatar or profile picture))
    - 'jobTitle': string (The persons job title)
    - 'worksFor': string (Company or organization the person works for)
    - 'address': string (The persons physical address)
    - 'telephone': string[] (Array of the persons phone numbers (e.g., mobile, WhatsApp))
    - 'sameAs': string[] (Array of the persons full correct profile URLs)

    ###CHAIN OF THOUGHT###

    1. **READ** the signature line by line
    2. **IDENTIFY** explicit values only (no assumptions)
    3. **PARSE** email, phone, socials, name, etc.
    4. **FORMAT** phone and links as required
    5. **BUILD** strict schema.org Person JSON
    6. **IGNORE** incomplete, unclear, or ambiguous data
    7. **OUTPUT** JSON only — no preamble or notes

    ###WHAT NOT TO DO###

    - DO NOT GUESS OR FIX SPELLING/CAPITALIZATION
    - DO NOT OUTPUT FIELDS NOT FULLY FOUND
    - DO NOT ADD FAKE OR DEFAULT DATA
    - DO NOT USE PARTIAL SOCIAL LINKS
    - DO NOT OUTPUT ANYTHING BUT JSON

    ###EXAMPLE###

    **Input:**
    Jane Smith  
    Marketing Lead  
    Bright Horizons Ltd.  
    jane@brighthorizons.co.uk  
    +44 7911 123456  
    1 Sunrise Way, London  
    Twitter: twitter.com/janesmith

    **Output:**
    {
      "@type": "Person",
      "name": "Jane Smith",
      "jobTitle": "Marketing Lead",
      "worksFor": "Bright Horizons Ltd.",
      "email": "jane@brighthorizons.co.uk",
      "telephone": "+447911123456",
      "address": "1 Sunrise Way, London",
      "sameAs": ["twitter.com/janesmith"]
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
      const response = await fetch(this.LLM_ENDPOINT, {
        method: 'POST',
        headers: this.headers(),
        body: this.body(signature)
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content;
    } catch (err) {
      this.logger.error('SignatureExtractionLLM error:', err);
      return null;
    }
  }

  public async extract(signature: string): Promise<PersonLD | null> {
    try {
      const content = await this.sendPrompt(signature);

      console.log(content);

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
