import axios, { AxiosError, AxiosInstance } from 'axios';

import { Logger } from 'winston';
import { logError } from '../../../utils/axios';
import { IRateLimiter } from '../../rate-limiter/RateLimiter';

interface Config {
  url: string;
  apiKey: string;
  rateLimiter: IRateLimiter;
}

interface Experience {
  starts_at: {
    day: number;
    month: number;
    year: number;
  };
  ends_at: {
    day?: number | null;
    month?: number | null;
    year?: number | null;
  };
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

export interface ProfileExtra {
  github_profile_id?: string;
  facebook_profile_id?: string;
  twitter_profile_id?: string;
  website?: string;
}

export interface ReverseEmailLookupParams {
  email: string;
  lookup_depth: 'superficial' | 'deep';
  enrich_profile?: 'skip' | 'enrich';
}

export interface ReverseEmailLookupResponse {
  email: string;
  profile: Profile;
  last_updated: string;
  similarity_score: number;
  linkedin_profile_url: string;
  facebook_profile_url: string;
  twitter_profile_url: string;
}

export default class ProxycurlApi {
  private readonly api: AxiosInstance;

  private readonly rateLimiter;

  private readonly maxRetries: number = 5;

  constructor(
    { url, apiKey, rateLimiter }: Config,
    private readonly logger: Logger
  ) {
    this.api = axios.create({
      baseURL: url,
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    this.rateLimiter = rateLimiter;
  }

  async reverseEmailLookup({
    email,
    lookup_depth: lookupDepth,
    enrich_profile: enrichProfile
  }: ReverseEmailLookupParams) {
    const response = await this.rateLimitRetryWithExponentialBackoff(
      async () => {
        try {
          const res = await this.rateLimiter.throttleRequests(() =>
            this.api.get<ReverseEmailLookupResponse>(
              '/api/linkedin/profile/resolve/email',
              {
                params: {
                  email,
                  lookup_depth: lookupDepth,
                  enrich_profile: enrichProfile
                }
              }
            )
          );
          return res;
        } catch (error) {
          logError(
            error,
            `[${this.constructor.name}:verifyEmail]`,
            this.logger
          );
          throw error;
        }
      }
    );
    return { ...response.data, email };
  }

  private async rateLimitRetryWithExponentialBackoff<T>(
    fn: (attempt: number) => Promise<T>,
    attempt = 1
  ): Promise<T> {
    const sleep = (delay: number): Promise<void> =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, delay);
      });
    try {
      const response = await fn(attempt);
      return response;
    } catch (error) {
      if ((error as AxiosError).response?.status !== 429) {
        throw new Error(
          (error as AxiosError).message || 'Request failed with unknown error.'
        );
      }
      if (attempt >= this.maxRetries) {
        logError(
          error,
          `[${this.constructor.name}: Exhausted retries]`,
          this.logger
        );
        throw error;
      }
      const delay = 2 ** attempt * 1000;
      this.logger.info(
        `[${this.constructor.name}:rateLimitRetryWithExponentialBackoff] Rate limited, retrying attempt ${attempt} waiting ${delay}ms before retry`
      );
      await sleep(delay);
      return this.rateLimitRetryWithExponentialBackoff(fn, attempt + 1);
    }
  }
}
