/**
 * TheDig enrichment engine, ported from
 * `backend/src/services/enrichment/thedig/index.ts` and
 * `backend/src/services/enrichment/thedig/client.ts` and merged into a
 * single class for the Deno edge runtime.
 *
 * Edge-specific adaptations:
 * - The original `axios` HTTP client is replaced with a native `fetch`
 *   wrapper.
 * - The original `winston` Logger is replaced with the shared edge
 *   `createLogger` from `../_shared/logger.ts`.
 * - The backend `TokenBucketRateLimiter` (PostgreSQL-aware) is replaced
 *   with the edge variant from `../_shared/rate-limiter.ts` which only
 *   supports `Memory` and `Redis` distributions.
 * - Environment variables are read with `Deno.env.get` rather than from
 *   the backend `ENV` config object.
 */

import type { Logger } from "../../_shared/logger.ts";
import { createLogger } from "../../_shared/logger.ts";
import { TokenBucketRateLimiter } from "../../_shared/rate-limiter.ts";
import type { Engine, EngineResponse, EngineResult, Person } from "./engine.ts";
import { undefinedIfEmpty, undefinedIfFalsy } from "./validation.ts";

/** Payload shape accepted by the TheDig `/person/` endpoint. */
export interface EnrichPersonRequest {
  url?: string;
  name?: string;
  email: string;
  OptOut?: boolean;
  familyName?: string;
  givenName?: string;
  image?: string[];
  sameAs?: string[];
  jobTitle?: string[];
  worksFor?: string[];
  identifier?: string[];
  nationality?: string[];
  description?: string[];
  homeLocation?: string;
  workLocation?: string;
  alternateName?: string[];
  knowsLanguage?: string[];
}

/** Shape of a single person response from the TheDig API. */
export interface EnrichPersonResponse {
  email: string;
  name: string;
  givenName: string;
  familyName?: string;
  alternateName?: string[];
  image?: string[];
  jobTitle?: string[];
  worksFor?: string[];
  homeLocation?: string;
  workLocation?: string;
  sameAs?: string[];
  identifier?: string[];
  description?: string[];
  knowsLanguage?: string[];
  nationality?: string[];
  OptOut?: boolean;
  url?: string;
  error_msg?: string;
  statusCode: number;
}

/** Response shape for the async bulk upload (`/person/bulk`) endpoint. */
interface EnrichBulkResponse {
  status: string;
  success: boolean;
  token: string;
}

export default class Thedig implements Engine {
  readonly name = "thedig";

  readonly isSync = true;

  readonly isAsync = false;

  private readonly baseUrl: string;

  private readonly apiToken: string;

  private readonly rateLimiter: TokenBucketRateLimiter;

  private readonly logger: Logger;

  constructor() {
    this.baseUrl = Deno.env.get("THEDIG_URL") || "";
    this.apiToken = Deno.env.get("THEDIG_API_KEY") || "";
    this.rateLimiter = new TokenBucketRateLimiter(
      "email-enrichment-theDig",
      "read",
      { requests: 55, intervalSeconds: 60 },
    );
    this.logger = createLogger("enrich-thedig");
  }

  // eslint-disable-next-line class-methods-use-this
  isValid(contact: Partial<Person>): boolean {
    return Boolean(contact.email && contact.name);
  }

  async enrichSync(person: Partial<Person>): Promise<EngineResponse> {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichSync request`,
      person,
    );
    try {
      const personMapped = Thedig.mapForClientRequest(person);
      const response = await this.enrich(personMapped);
      let enrichResponse = this.parseResult([response]);
      if (response.statusCode === 203 && !response.sameAs?.length) {
        enrichResponse = {
          engine: this.name,
          data: [],
          raw_data: [response],
        };
      }
      return enrichResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    }
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
      const mapped = persons.map(Thedig.mapForClientRequest);
      const response = await this.enrichBulk(
        mapped.map(({ name, email }) => ({ name, email })),
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

  /**
   * Maps the public `Person` shape to the payload expected by the
   * TheDig API. Optional fields with falsy values are dropped to keep
   * the request body small.
   */
  static mapForClientRequest(person: Partial<Person>): EnrichPersonRequest {
    let personMapped: EnrichPersonRequest = {
      email: person.email as string,
      name: person.name as string,
      homeLocation: person.location,
      alternateName: person.alternate_name,
      familyName: person.family_name,
      givenName: person.given_name,
      identifier: person.identifiers,
      image: person.image ? [person.image] : undefined,
      jobTitle: person.job_title ? [person.job_title] : undefined,
      sameAs: person.same_as,
      url: person.url,
      workLocation: person.location,
      worksFor: person.works_for ? [person.works_for] : undefined,
    };

    personMapped = Object.fromEntries(
      Object.entries(personMapped).filter(([, value]) => Boolean(value)),
    ) as EnrichPersonRequest;
    return personMapped;
  }

  parseResult(enrichedData: EnrichPersonResponse[]): EngineResponse {
    this.logger.debug(
      `[${this.constructor.name}]-[parseResult]: Parsing enrichment results`,
      { enrichedData },
    );
    const results = enrichedData;
    const enriched: EngineResult[] = results
      .map((person) => ({
        email: person.email,
        name: undefinedIfFalsy(person.name),
        givenName: undefinedIfFalsy(person.givenName),
        familyName: undefinedIfFalsy(person.familyName),
        image: undefinedIfFalsy(person.image?.[0]),
        jobTitle: undefinedIfFalsy(person.jobTitle?.[0]),
        organization: undefinedIfFalsy(person.worksFor?.[0]),
        sameAs: undefinedIfEmpty(person.sameAs ?? []),
        identifiers: undefinedIfEmpty(person.identifier ?? []),
        alternateName: undefinedIfEmpty(person.alternateName ?? []),
        location: undefinedIfFalsy(
          [person.homeLocation, person.workLocation]
            .flat()
            .filter(Boolean)
            .join(", "),
        ),
      }))
      .filter(
        ({
          givenName,
          familyName,
          sameAs,
          organization,
          jobTitle,
          location,
          alternateName,
          image,
        }) =>
          ![
            givenName,
            familyName,
            sameAs,
            organization,
            jobTitle,
            location,
            alternateName,
            image,
          ].every((field) => !field || field.length === 0),
      );
    return {
      engine: this.name,
      data: enriched,
      raw_data: results,
    };
  }

  /**
   * Calls the TheDig `/person/` endpoint, throttled by the shared rate
   * limiter. Mirrors the backend client's `enrich` method.
   */
  private async enrich(
    person: EnrichPersonRequest,
  ): Promise<EnrichPersonResponse> {
    try {
      await this.rateLimiter.removeTokens(1);
      const res = await fetch(`${this.baseUrl}/person/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiToken,
        },
        body: JSON.stringify(person),
      });
      if (!res.ok) {
        throw new Error(
          `TheDig API error: ${res.status} ${res.statusText}`,
        );
      }
      const data = (await res.json()) as Partial<EnrichPersonResponse>;
      return {
        ...data,
        email: (data.email as string) ?? "",
        name: (data.name as string) ?? "",
        givenName: (data.givenName as string) ?? "",
        statusCode: data.statusCode ?? res.status,
      };
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name}:enrich]`,
        { error: (error as Error).message },
      );
      throw error;
    }
  }

  /**
   * Calls the TheDig `/person/bulk` endpoint and returns the async job
   * token to be polled via the supplied webhook.
   */
  private async enrichBulk(
    persons: EnrichPersonRequest[],
    webhook: string,
  ): Promise<EnrichBulkResponse> {
    try {
      await this.rateLimiter.removeTokens(1);
      const res = await fetch(
        `${this.baseUrl}/person/bulk?endpoint=${webhook}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": this.apiToken,
          },
          body: JSON.stringify(persons),
        },
      );
      if (!res.ok) {
        throw new Error(
          `TheDig bulk API error: ${res.status} ${res.statusText}`,
        );
      }
      const data = await res.json();
      return {
        status: "running",
        success: true,
        token: data as string,
      };
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name}:enrichBulk]`,
        { error: (error as Error).message },
      );
      throw error;
    }
  }
}
