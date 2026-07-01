/**
 * Voilanorbert enrichment engine, ported from
 * `backend/src/services/enrichment/voilanorbert/index.ts` and
 * `backend/src/services/enrichment/voilanorbert/client.ts` and merged
 * into a single class for the Deno edge runtime.
 *
 * Voilanorbert is an async-only engine: the synchronous `enrichSync`
 * method is intentionally not implemented. The caller submits a list of
 * emails and a webhook URL; Voilanorbert POSTs the enrichment results
 * back to that webhook.
 *
 * Edge-specific adaptations:
 * - The original `axios` HTTP client is replaced with a native `fetch`
 *   wrapper.
 * - The original `winston` Logger is replaced with the shared edge
 *   `createLogger` from `../_shared/logger.ts`.
 * - The original `qs.stringify(...)` form body is replaced with
 *   `URLSearchParams`.
 * - The backend `TokenBucketRateLimiter` (PostgreSQL-aware) is replaced
 *   with the edge variant from `../_shared/rate-limiter.ts` which only
 *   supports `Memory` and `Redis` distributions.
 * - Environment variables are read with `Deno.env.get` rather than from
 *   the backend `ENV` config object.
 */

import type { Logger } from "../../_shared/logger.ts";
import { createLogger } from "../../_shared/logger.ts";
import { TokenBucketRateLimiter } from "../../_shared/rate-limiter.ts";
import type { Engine, EngineResponse, Person } from "./engine.ts";
import { undefinedIfEmpty, undefinedIfFalsy } from "./validation.ts";

interface Result {
  email: string;
  fullName: string;
  title: string;
  organization: string;
  location: string;
  twitter: string;
  linkedin: string;
  facebook: string;
  error_msg?: string;
}

/** Response shape of the async upload endpoint. */
export interface ResponseAsync {
  status: string;
  success: boolean;
  token: string;
}

/** Payload posted to the webhook by Voilanorbert when results land. */
export interface ResponseWebhook {
  id: string;
  token: string;
  results: Result[];
}

export default class Voilanorbert implements Engine {
  readonly name = "voilanorbert";

  readonly isSync = false;

  readonly isAsync = true;

  private static readonly defaultBaseUrl =
    "https://api.voilanorbert.com/2018-01-08/";

  private readonly baseUrl: string;

  private readonly username: string;

  private readonly apiToken: string;

  private readonly rateLimiter: TokenBucketRateLimiter;

  private readonly logger: Logger;

  constructor() {
    this.baseUrl = Deno.env.get("VOILANORBERT_URL") || Voilanorbert.defaultBaseUrl;
    this.username = Deno.env.get("VOILANORBERT_USERNAME") || "";
    this.apiToken = Deno.env.get("VOILANORBERT_API_KEY") || "";
    this.rateLimiter = new TokenBucketRateLimiter(
      "email-enrichment-voilanorbert",
      "read",
      { requests: 115, intervalSeconds: 60 },
    );
    this.logger = createLogger("enrich-voilanorbert");
  }

  // eslint-disable-next-line class-methods-use-this
  isValid(contact: Partial<Person>): boolean {
    return Boolean(contact.email);
  }

  enrichSync(person: Partial<Person>): Promise<EngineResponse> {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichSync request`,
      person,
    );
    return Promise.reject(
      new Error(
        `[${this.constructor.name}]: method enrichSync not implemented.`,
      ),
    );
  }

  async enrichAsync(
    persons: Partial<Person>[],
    webhook: string,
  ): Promise<EngineResponse> {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichAsync request`,
      { persons },
    );
    try {
      const response = await this.enrich(
        persons.map(({ email }) => email as string),
        webhook,
      );

      if (!response.success) {
        throw new Error("Failed to upload emails to enrichment.");
      }

      return {
        engine: this.name,
        token: response.token,
        data: [],
        raw_data: [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    }
  }

  parseResult(enrichedData: unknown[]): EngineResponse {
    this.logger.debug(
      `[${this.constructor.name}]-[parseResult]: Parsing enrichment results`,
      { enrichedData },
    );
    // The webhook payload wraps the result list in `{ results: [...] }`
    // but historical callers also pass the bare array. Fall back to the
    // bare array when `results` is absent to keep the parse robust.
    const wrapped = enrichedData[0] as ResponseWebhook | undefined;
    const results = wrapped?.results ?? (enrichedData as Result[]);
    const enriched = results
      .map((result) => ({
        email: result.email,
        image: undefinedIfFalsy(""),
        name: undefinedIfFalsy(result.fullName),
        organization: undefinedIfFalsy(result.organization),
        jobTitle: undefinedIfFalsy(result.title),
        location: undefinedIfFalsy(result.location),
        sameAs: undefinedIfEmpty([
          result.facebook,
          result.linkedin,
          result.twitter,
        ]),
      }))
      .filter(
        ({ email, name, location, organization, jobTitle, sameAs }) =>
          email !== "Email" &&
          ![name, location, organization, jobTitle, sameAs].every(
            (field) => field === undefined || field.length === 0,
          ),
      );
    return {
      engine: this.name,
      data: enriched,
      raw_data: results,
    };
  }

  /**
   * POSTs a list of emails and a webhook URL to the Voilanorbert
   * `/enrich/upload` endpoint and returns the async job token.
   */
  private async enrich(
    emails: string[],
    webhook: string,
  ): Promise<ResponseAsync> {
    try {
      await this.rateLimiter.removeTokens(1);
      const credentials = btoa(`${this.username}:${this.apiToken}`);
      const formData = new URLSearchParams();
      formData.append("data", emails.join("\n"));
      formData.append("webhook", webhook);

      const res = await fetch(`${this.baseUrl}/enrich/upload`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });
      if (!res.ok) {
        throw new Error(
          `Voilanorbert API error: ${res.status} ${res.statusText}`,
        );
      }
      const data = await res.json() as ResponseAsync;
      return data;
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name}:enrich]`,
        { error: (error as Error).message },
      );
      throw error;
    }
  }
}
