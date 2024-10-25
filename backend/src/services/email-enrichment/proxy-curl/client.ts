import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import throttledQueue from 'throttled-queue';
import { logError } from '../../../utils/axios';

export interface Experience {
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

export interface ProfileExtra {
  github_profile_id?: string;
  facebook_profile_id?: string;
  twitter_profile_id?: string;
  website?: string;
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

export interface Config {
  url: string;
  apiKey: string;
}

export default class ProxyCurl {
  private readonly api: AxiosInstance;

  private readonly rate_limit_handler;

  private static readonly maxRetries = 5;

  constructor({ url, apiKey }: Config, private readonly logger: Logger) {
    this.api = axios.create({
      baseURL: url,
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    this.rate_limit_handler = throttledQueue(300, 60 * 1000);
  }

  async reverseEmailLookup({
    email,
    lookup_depth: lookupDepth,
    enrich_profile: enrichProfile
  }: ReverseEmailLookupParams) {
    const response = await this.rateLimitRetryWithExponentialBackoff(
      async () => {
        try {
          const res = await this.rate_limit_handler(() =>
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
      return await fn(attempt);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status !== 429) {
        throw error;
      }
      if (attempt >= ProxyCurl.maxRetries) {
        logError(
          error,
          `[${this.constructor.name}: Exhausted retries]`,
          this.logger
        );
        throw error;
      }
      this.logger.info(
        `[${this.constructor.name}: ] Rate limited, retrying attempt ${attempt}`
      );
      const delay = 2 ** attempt * 1000;
      this.logger.info(`Waiting ${delay}ms before retry...`);
      sleep(delay);
      return this.rateLimitRetryWithExponentialBackoff(fn, attempt + 1);
    }
  }
}
