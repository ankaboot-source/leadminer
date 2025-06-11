import { Logger } from 'winston';
import { ExtractSignature, PersonLD } from './types';

export enum LLMModels {
  DeepSeek8bFree = 'deepseek/deepseek-r1-0528-qwen3-8b:free',
  Mistral7bFree = 'mistralai/mistral-7b-instruct:free'
}

export type LLMModelType = `${LLMModels}`;

export const SignaturePrompt = {
  system: `
    You are an AI that extracts structured contact data from email signatures.
    Your output must be a valid JSON object of type "Person" from schema.org.
    Only include the fields if they are available. Do not return natural language or comments.
    Return only a valid JSON object with these fields:
        - "@type": "Person" (required)
        - name (required)
        - image (URL, optional)
        - jobTitle (optional)
        - worksFor (optional)
        - address (optional)
        - telephone (optional)
        - sameAs (optional array of URLs)

    Ensure the response is valid according to the provided JSON schema.`,

  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'personSignature',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          '@type': { type: 'string', const: 'Person' },
          name: { type: 'string' },
          image: { type: 'string', format: 'uri' },
          jobTitle: { type: 'string' },
          worksFor: { type: 'string' },
          address: { type: 'string' },
          telephone: { type: 'string' },
          sameAs: {
            type: 'array',
            items: { type: 'string', format: 'uri' }
          }
        },
        required: ['@type', 'name'],
        additionalProperties: false
      }
    }
  },

  buildUserPrompt: (signature: string) => `email signature:\n\n${signature}`
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
        telephone: person.telephone ? [person.telephone] : [],
        sameAs: person.sameAs
      };
    } catch (err) {
      this.logger.error('SignatureExtractionLLM error:', err);
      return null;
    }
  }
}
