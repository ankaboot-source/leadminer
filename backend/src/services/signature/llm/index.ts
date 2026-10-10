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
import { errorMeta } from '../../../utils/errors';

/**
 * The contract the model is asked to satisfy. It is intentionally NOT sent as
 * `response_format.json_schema`: structured outputs are not honoured by the
 * ZDR-routed endpoints OpenRouter selects (see `response_format` below). The
 * shape is kept here as the single source of truth for the expected output and
 * for the unit tests.
 */
export const SIGNATURE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    '@type': {
      type: 'string',
      const: 'Person',
      description: 'Must always be "Person" as per schema.org type definition'
    },
    // Every field is nullable on purpose. Under strict mode a model must
    // emit every key in `required`, so a non-nullable string forces it to
    // produce a value for data that simply is not there. Measured on 80
    // real signatures: non-nullable gave 0.681 accuracy, and telling the
    // model to return null without this change made things *worse* (0.655)
    // because the instruction contradicted the schema. With null
    // permitted, accuracy rose to 0.776 and the decline rate doubled,
    // because declining is finally expressible.
    name: {
      type: ['string', 'null'],
      description: 'Full name, or null if not present'
    },
    jobTitle: {
      type: ['string', 'null'],
      description: 'Job title, or null if not present'
    },
    worksFor: {
      type: ['string', 'null'],
      description: 'Employer or organisation, or null if not present'
    },
    email: {
      type: ['string', 'null'],
      description: 'Email address, or null if not present'
    },
    telephone: {
      type: ['array', 'null'],
      description: 'Phone numbers in E.164, or null if not present',
      items: {
        type: 'string',
        pattern: '\\+\\d{7,15}'
      }
    },
    address: {
      type: ['string', 'null'],
      description: 'Postal address, or null if not present'
    },
    sameAs: {
      type: ['array', 'null'],
      description: 'Profile or website URLs, or null if not present',
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
};

export const SignaturePrompt = {
  // `json_schema` (structured outputs) is not honoured by the ZDR-routed
  // endpoints OpenRouter selects: measured live, `json_schema` returned an
  // empty object `{}` for every request against
  // mistralai/ministral-14b-2512, `null` against google/gemini-2.5-flash, and an
  // outright provider error against anthropic/claude-sonnet-4.5 and
  // openai/gpt-4o-mini. `json_object` returns a complete, schema-shaped object
  // on all four. `removeFalsePositives` then drops any field that is not
  // literally present in the signature, so the response format only has to be
  // parseable JSON, not schema-enforced.
  response_format: { type: 'json_object' },
  buildUserPrompt: (email: string, signature: string) =>
    `
    You are a deterministic structured-data extraction engine specialized in parsing email signatures.
    Your output is consumed by financial and enterprise systems. Accuracy is mandatory, and guessing is forbidden.

    ### OUTPUT FORMAT (STRICT)
    - Return ONLY a JSON object matching the provided JSON schema.
    - Do NOT add fields not present in the schema.
    - Do NOT return text outside JSON.

    ### REJECT NON-SIGNATURES FIRST
    Before extracting anything, decide whether the text is a REAL HUMAN SIGNATURE BLOCK.

    Set every field to null when it is NOT a person's signature:
    - a device or mail-client footer ("Sent from ...", "Get Outlook for iOS")
    - a mailing-list, newsletter, or unsubscribe footer
    - a legal or confidentiality disclaimer
    - a quoted-reply header ("On <date> ... wrote:", or its equivalent in ANY language)
    - message body text with no identifying details about a person
    - content belonging to a role account (support@, noreply@, news@, admin@)

    It is a signature only if it plausibly belongs to one specific, identifiable human being.
    When you are not confident, set every field to null. A null field is always better than an
    invented value.

    ### EXTRACTION RULES (STRICT)
    - **Crucial:** Include ONLY fields that successfully conform to their specific rules and appear explicitly in the signature.
    - NEVER infer, guess, or rewrite missing information.
    - Use null for any field that is not explicitly present. Do not invent a value to fill a slot.


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
    - IMPORTANT: the role is often glued to the company with no space before "at" (e.g. "CFOatHolberton", "Software Engineer and Education LeadatHolberton"). Split at the "at" and take the part before it as the jobTitle, even though the literal role is not a standalone token in the signature.

    **worksFor**
    - The name of the company, organization, or government body.
    - Strictly Reject: Divisions, departments (e.g., "Sales Division"), addresses, cities, names of publications, or titles that are not formal organization names.
    - IMPORTANT: the company is often glued to the role with no space before "at" (e.g. "CFOatHolberton" = role "CFO" at company "Holberton"). Split at the "at" and take the part after it as the worksFor, even though the literal company name is not a standalone token in the signature.

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


    Given the following signature text from an email address with the domain ${String(email).split('@').pop()}, extract explicitly present fields into the JSON format.

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

  MAX_OUTPUT_TOKENS = 1000;

  private active = true;

  constructor(
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: Logger,
    private readonly models: LLMModelType[],
    private readonly apiKey: string,
    /**
     * Restrict routing to Zero Data Retention endpoints, so prompts are not
     * retained by the inference provider. Signature blocks are personal data.
     * Off by default: ZDR endpoints are a minority and are often slower and
     * dearer than the default pool.
     */
    private readonly requireZdr = false
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
    const models = this.models.slice(0, 3);

    const body: Record<string, unknown> = {
      models,
      messages: [
        {
          role: 'user',
          content: SignaturePrompt.buildUserPrompt(email, signature)
        }
      ],
      response_format: SignaturePrompt.response_format,
      max_tokens: this.MAX_OUTPUT_TOKENS,
      // Signature extraction is a constrained, schema-bound copy task with no
      // reasoning to do. Reasoning models spend 500-1100 of MAX_OUTPUT_TOKENS
      // thinking before emitting any JSON, then return finish_reason 'length'
      // with empty or truncated content, which extract() discards as a parse
      // failure — indistinguishable from an email that has no signature.
      //
      // This applies to the whole fallback chain: OpenRouter sends one body to
      // every model in `models`. A provider that rejects the field with
      // HTTP 400 ("Reasoning is mandatory for this endpoint") cannot be used
      // in this list.
      reasoning: { enabled: false }
    };

    if (this.requireZdr) {
      // Only route to endpoints that keep no copy of the prompt or completion.
      body.provider = { zdr: true };
    }

    return JSON.stringify(body);
  }

  /**
   * OpenRouter reports "no endpoint matches your data policy" from the routing
   * funnel as a 404, not as a transport failure, so it never reaches the
   * 402/502/503 branch below and was previously indistinguishable from any
   * other rejection.
   *
   * It is also intermittent: measured against live OpenRouter, twelve
   * consecutive ZDR requests all served, with the occasional 404 in between.
   * So this only reports. It does not disable the engine — that turned a
   * momentary blip into a permanent downgrade to the regex engine — and it does
   * not retry without ZDR, since a retaining endpoint is exactly what the flag
   * exists to avoid.
   *
   * Keyed on `failed_routing_step` because it is a documented field, with the
   * message text as a fallback for responses that omit metadata.
   */
  private isZdrUnavailable(error: OpenRouterError['error']) {
    if (!this.requireZdr) return false;

    const failedStep = error.metadata?.failed_routing_step;
    if (typeof failedStep === 'string') {
      return failedStep.toLowerCase().includes('data policy');
    }

    const message = error.message?.toLowerCase() ?? '';
    return (
      message.includes('data policy') || message.includes('zero data retention')
    );
  }

  private handleResponseError(error: OpenRouterError['error']) {
    // Report only: the engine stays active so a transient failure costs one
    // signature rather than the whole engine. extract() still returns null for
    // this request, so nothing unverified is stored.
    if (this.isZdrUnavailable(error)) {
      this.logger.warn(
        'No ZDR endpoint available for the configured models — this signature ' +
          'was not extracted. OpenRouter answers this intermittently even when ' +
          'ZDR endpoints exist, so the next attempt may succeed. If it persists, ' +
          'choose models with ZDR support or set SIGNATURE_LLM_REQUIRE_ZDR=false.'
      );
      throw new Error(error.message);
    }

    if ([402, 502, 503].includes(error.code)) {
      this.active = false;
      this.logger.warn(
        'LLM engine down — check credits balance or expired/invalid API token'
      );
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
      let error: { message?: string; code?: number } =
        err instanceof Error ? err : { message: String(err) };
      let openRouterErrorData: OpenRouterError['error'] | null = null;

      if (
        err instanceof AxiosError &&
        err?.response?.data &&
        'error' in err.response.data
      ) {
        openRouterErrorData = (err.response?.data as OpenRouterError).error;
        error = openRouterErrorData;
      }

      this.logger.error(
        `SignaturePromptLLM error: ${error.message ?? 'Unexpected error'}`,
        {
          error: error.message
        }
      );

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

      if (!content || content.toLowerCase() === 'null') {
        this.logger.debug('Received empty or null response. skipping parse');
        return null;
      }

      if (content.length > this.MAX_OUTPUT_TOKENS) {
        this.logger.debug('Model response was too large, skipping parse');
        return null;
      }

      const parsed = JSON.parse(content);
      const person = Array.isArray(parsed) ? parsed[0] : parsed;

      if (!person || person['@type'] !== 'Person') return null;

      return this.cleanOutput(signature, person);
    } catch (err) {
      this.logger.error(
        `SignatureExtractionLLM error: ${(err as Error)?.message}`,
        { error: errorMeta(err) }
      );
      return null;
    }
  }
}
