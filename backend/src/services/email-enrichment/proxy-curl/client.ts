import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
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

  constructor({ url, apiKey }: Config, private readonly logger: Logger) {
    this.api = axios.create({
      baseURL: url,
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
  }

  async reverseEmailLookup({
    email,
    lookup_depth: lookupDepth,
    enrich_profile: enrichProfile
  }: ReverseEmailLookupParams) {
    try {
      const response = await this.api.get<ReverseEmailLookupResponse>(
        '/api/linkedin/profile/resolve/email',
        {
          params: {
            email,
            lookup_depth: lookupDepth,
            enrich_profile: enrichProfile
          }
        }
      );
      return { ...response.data, email };
    } catch (error) {
      logError(
        error,
        `[${this.constructor.name}:reverseEmailLookup]`,
        this.logger
      );
      throw error;
    }
  }
}
