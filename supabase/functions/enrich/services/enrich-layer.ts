/**
 * EnrichLayer enrichment engine, ported from
 * `backend/src/services/enrichment/enrich-layer/index.ts` and
 * `backend/src/services/enrichment/enrich-layer/client.ts` and merged
 * into a single class for the Deno edge runtime.
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
import type { Engine, EngineResponse, Person } from "./engine.ts";
import { undefinedIfEmpty, undefinedIfFalsy } from "./validation.ts";

/** Extra profile fields returned by the EnrichLayer API. */
export interface ProfileExtra {
  github_profile_id?: string;
  facebook_profile_id?: string;
  twitter_profile_id?: string;
  website?: string;
}

interface Experience {
  starts_at: { day: number; month: number; year: number };
  ends_at: { day?: number | null; month?: number | null; year?: number | null };
  company: string;
  company_linkedin_profile_url?: string | null;
  company_facebook_profile_url?: string | null;
  title: string;
  description: string;
  location?: string | null;
  logo_url?: string | null;
}

interface Profile {
  city: string;
  full_name: string;
  first_name: string;
  last_name: string;
  state: string;
  country: string;
  country_full_name: string;
  languages: string[];
  occupation: string;
  profile_pic_url: string;
  public_identifier: string;
  extra: ProfileExtra;
  experiences: Experience[];
}

/** Parameters accepted by the EnrichLayer reverse-email-lookup endpoint. */
export interface ReverseEmailLookupParams {
  email: string;
  lookup_depth: "superficial" | "deep";
  enrich_profile?: "skip" | "enrich";
}

/** Shape of a single response from the reverse-email-lookup endpoint. */
export interface ReverseEmailLookupResponse {
  email: string;
  profile: Profile;
  last_updated: string;
  similarity_score: number;
  linkedin_profile_url: string;
  facebook_profile_url: string;
  twitter_profile_url: string;
}

/**
 * The maximum number of times `reverseEmailLookup` will sleep and retry
 * after a 429 response. Bounds total wait time so a misbehaving server
 * cannot block a request indefinitely.
 */
const MAX_RETRIES = 5;

export default class EnrichLayer implements Engine {
  readonly name = "enrichLayer";

  readonly isSync = true;

  readonly isAsync = false;

  private readonly baseUrl: string;

  private readonly apiKey: string;

  private readonly rateLimiter: TokenBucketRateLimiter;

  private readonly logger: Logger;

  constructor() {
    this.baseUrl = Deno.env.get("ENRICHLAYER_URL") || "";
    this.apiKey = Deno.env.get("ENRICHLAYER_API_KEY") || "";
    this.rateLimiter = new TokenBucketRateLimiter(
      "email-enrichment-enrichLayer",
      "read",
      { requests: 295, intervalSeconds: 60 },
    );
    this.logger = createLogger("enrich-enrichlayer");
  }

  /**
   * Builds the list of social/website URLs present in the `extra`
   * profile block. Kept as a static so it can be unit-tested in
   * isolation without instantiating the engine.
   */
  static getProfileUrls(profile: ProfileExtra): string[] {
    const urls: string[] = [];

    if (profile?.github_profile_id) {
      urls.push(`https://github.com/${profile.github_profile_id}`);
    }
    if (profile?.facebook_profile_id) {
      urls.push(`https://facebook.com/${profile.facebook_profile_id}`);
    }
    if (profile?.twitter_profile_id) {
      urls.push(`https://twitter.com/${profile.twitter_profile_id}`);
    }
    if (profile?.website) {
      urls.push(profile.website);
    }

    return urls;
  }

  // eslint-disable-next-line class-methods-use-this
  isValid(contact: Partial<Person>): boolean {
    return Boolean(contact.email);
  }

  async enrichSync(person: Partial<Person>): Promise<EngineResponse> {
    try {
      this.logger.debug(`${this.constructor.name}.enrichSync request`, person);
      const response = await this.reverseEmailLookup({
        lookup_depth: "superficial",
        enrich_profile: "enrich",
        email: person.email as string,
      });
      return this.parseResult([response]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    }
  }

  enrichAsync(
    _persons: Partial<Person>[],
    _webhook: string,
  ): Promise<EngineResponse> {
    this.logger.debug(
      `${this.constructor.name}.enrichAsync request`,
      { _persons, _webhook },
    );
    return Promise.reject(new Error("Method not implemented."));
  }

  parseResult(data: ReverseEmailLookupResponse[]): EngineResponse {
    const [response] = data;
    const mapped = [
      {
        name: undefinedIfFalsy(response?.profile?.full_name ?? ""),
        givenName: undefinedIfFalsy(response?.profile?.first_name ?? ""),
        familyName: undefinedIfFalsy(response?.profile?.last_name ?? ""),
        jobTitle: undefinedIfFalsy(response?.profile?.occupation ?? ""),
        organization: undefinedIfFalsy(
          response?.profile?.experiences?.[0]?.company ?? "",
        ),
        image: undefinedIfFalsy(response?.profile?.profile_pic_url ?? ""),
        identifiers: undefinedIfEmpty(
          [response?.profile?.public_identifier].filter((id): id is string =>
            Boolean(id)
          ),
        ),
        location: undefinedIfFalsy(
          [
            response?.profile?.city,
            response?.profile?.state,
            response?.profile?.country_full_name,
          ]
            .filter((loc): loc is string => Boolean(loc))
            .join(", "),
        ),
        sameAs: undefinedIfEmpty([
          response?.linkedin_profile_url,
          response?.facebook_profile_url,
          response?.twitter_profile_url,
          ...EnrichLayer.getProfileUrls(response?.profile?.extra),
        ]),
      },
    ]
      .filter(
        (result) =>
          !Array.from(Object.values(result)).every(
            (field) => field === undefined || field.length === 0,
          ),
      )
      .pop();

    this.logger.debug(
      `[${this.constructor.name}]-[parseResult]: Parsing results`,
      mapped,
    );

    return {
      engine: this.name,
      data: mapped ? [{ email: response.email, ...mapped }] : [],
      raw_data: [response],
    };
  }

  /**
   * Calls the EnrichLayer `/api/v2/profile/resolve/email` endpoint,
   * throttled by the shared rate limiter and retried with exponential
   * backoff on 429 responses.
   */
  private async reverseEmailLookup(
    params: ReverseEmailLookupParams,
  ): Promise<ReverseEmailLookupResponse> {
    return await this.rateLimitRetryWithExponentialBackoff(async () => {
      await this.rateLimiter.removeTokens(1);
      const url = new URL("/api/v2/profile/resolve/email", this.baseUrl);
      url.searchParams.set("email", params.email);
      url.searchParams.set("lookup_depth", params.lookup_depth);
      if (params.enrich_profile) {
        url.searchParams.set("enrich_profile", params.enrich_profile);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (res.status === 429) {
        // Surface 429 as a thrown error so the retry helper below can
        // catch it. We use a sentinel object to avoid leaking fetch's
        // response object out of this function.
        const err = new Error(`EnrichLayer rate limited: ${res.status}`);
        (err as Error & { status?: number }).status = 429;
        throw err;
      }
      if (!res.ok) {
        throw new Error(
          `EnrichLayer API error: ${res.status} ${res.statusText}`,
        );
      }
      const data: Omit<ReverseEmailLookupResponse, "email"> = await res.json();
      return { ...data, email: params.email };
    });
  }

  /**
   * Runs `fn`, retrying on 429 with exponential backoff. Non-429 errors
   * are re-thrown immediately. Mirrors the behavior of the backend's
   * `rateLimitRetryWithExponentialBackoff`.
   */
  private async rateLimitRetryWithExponentialBackoff<T>(
    fn: (attempt: number) => Promise<T>,
    attempt = 1,
  ): Promise<T> {
    const sleep = (delay: number): Promise<void> =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, delay);
      });
    try {
      return await fn(attempt);
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (status !== 429) {
        throw error;
      }
      if (attempt >= MAX_RETRIES) {
        this.logger.error(
          `[${this.constructor.name}: Exhausted retries]`,
          { error: (error as Error).message },
        );
        throw error;
      }
      const delay = 2 ** attempt * 1000;
      this.logger.info(
        `[${this.constructor.name}:rateLimitRetryWithExponentialBackoff] Rate limited, retrying attempt ${attempt} waiting ${delay}ms before retry`,
      );
      await sleep(delay);
      return this.rateLimitRetryWithExponentialBackoff(fn, attempt + 1);
    }
  }
}
